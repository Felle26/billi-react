use crate::machine_id;
use chrono::{DateTime, NaiveDate};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

// Produkt-ID dieser App im Lizenz-Backend (hier eintragen).
const PRODUCT_ID: i64 = 0;
const API_BASE: &str = env!("LICENSE_API_BASE");
const STATE_FILE: &str = "license_state.json";
const OFFLINE_GRACE_SECS: i64 = 7 * 24 * 60 * 60;
const DAY_SECS: i64 = 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum LicenseError {
    /// Server nicht erreichbar oder unbrauchbare Antwort – führt nie zum Sperren.
    Network { message: String },
    /// Echte Ablehnung durch den Server (4xx mit reason).
    Rejected { reason: String, message: String },
    /// Lokaler Fehler (Dateisystem, Gerätekennung, Browser).
    Local { message: String },
}

impl LicenseError {
    fn network(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    fn local(message: impl Into<String>) -> Self {
        Self::Local {
            message: message.into(),
        }
    }

    fn message(&self) -> &str {
        match self {
            Self::Network { message } | Self::Local { message } => message,
            Self::Rejected { message, .. } => message,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    /// "trial", "perpetual" oder "subscription"
    pub kind: String,
    pub product: String,
    pub expires_at: Option<String>,
    pub days_left: Option<i64>,
    pub offline: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TrialOffer {
    Available,
    Running,
    Used,
    Unknown,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum StartupState {
    Active {
        status: LicenseStatus,
    },
    Dialog {
        message: Option<String>,
        trial: TrialOffer,
    },
    TrialExpired {
        message: String,
    },
    OfflineExpired {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum Mode {
    Key(String),
    Trial,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(default)]
struct LocalState {
    mode: Option<Mode>,
    last_ok_at: Option<i64>,
    expires_at: Option<String>,
    status: Option<LicenseStatus>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(default, rename_all = "camelCase")]
struct ApiResponse {
    valid: bool,
    ok: bool,
    reason: Option<String>,
    message: Option<String>,
    product: Option<String>,
    #[serde(rename = "type")]
    kind: Option<String>,
    expires_at: Option<String>,
    days_left: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TrialRequest {
    product_id: i64,
    machine_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    machine_name: Option<String>,
    start: bool,
}

#[derive(Serialize)]
struct RequestCodeRequest {
    key: String,
    email: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivateRequest {
    key: String,
    machine_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    machine_name: Option<String>,
    email: String,
    code: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceRequest {
    key: String,
    machine_id: String,
}

// ---------- Antworten interpretieren ----------

fn default_message(reason: &str) -> &'static str {
    match reason {
        "trial_expired" => "Der Testzeitraum ist abgelaufen.",
        "no_trial" => "Auf diesem Gerät wurde noch kein Testzeitraum gestartet.",
        "not_found" => "Der Lizenzschlüssel bzw. das Produkt wurde nicht gefunden.",
        "rate_limited" => "Zu viele Anfragen von dieser Adresse. Bitte versuche es später erneut.",
        "not_activated" => "Der Lizenzschlüssel ist auf diesem Gerät nicht aktiviert.",
        "revoked" => "Diese Lizenz wurde widerrufen.",
        "expired" => "Diese Lizenz ist abgelaufen.",
        "email_required" => "Bitte gib die E-Mail-Adresse des Käufers ein.",
        "code_required" => "Bitte gib den Aktivierungscode aus der E-Mail ein.",
        "limit_reached" => "Die maximale Anzahl an Geräten für diese Lizenz ist erreicht.",
        "bad_request" => "Die Eingabe ist ungültig.",
        _ => "Die Lizenz konnte nicht geprüft werden.",
    }
}

fn unexpected(status: u16) -> LicenseError {
    LicenseError::network(format!(
        "Der Lizenzserver hat unerwartet geantwortet (HTTP {status})."
    ))
}

fn interpret(status: u16, body: &str) -> Result<ApiResponse, LicenseError> {
    let Ok(response) = serde_json::from_str::<ApiResponse>(body) else {
        return Err(unexpected(status));
    };

    if status < 300 && (response.valid || response.ok) {
        return Ok(response);
    }

    match response.reason {
        Some(reason) if (400..500).contains(&status) => {
            let message = response
                .message
                .filter(|message| !message.trim().is_empty())
                .unwrap_or_else(|| default_message(&reason).to_owned());
            Err(LicenseError::Rejected { reason, message })
        }
        _ => Err(unexpected(status)),
    }
}

/// Ok(true) = abgemeldet, Ok(false) = dem Server war das Gerät nicht (mehr) bekannt.
fn interpret_deactivate(status: u16, body: &str) -> Result<bool, LicenseError> {
    if status == 404 {
        return Ok(false);
    }
    interpret(status, body).map(|_| true)
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

fn parse_expiry(value: &str) -> Option<i64> {
    if let Ok(date_time) = DateTime::parse_from_rfc3339(value) {
        return Some(date_time.timestamp());
    }
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").ok()?;
    Some(date.and_hms_opt(23, 59, 59)?.and_utc().timestamp())
}

fn days_until(expires_at: &str, now: i64) -> Option<i64> {
    let remaining = (parse_expiry(expires_at)? - now).max(0);
    Some((remaining + DAY_SECS - 1) / DAY_SECS)
}

fn to_status(response: &ApiResponse, now: i64) -> Result<LicenseStatus, LicenseError> {
    let kind = response
        .kind
        .clone()
        .ok_or_else(|| LicenseError::network("Die Antwort des Lizenzservers ist unvollständig."))?;
    let days_left = response
        .days_left
        .map(|days| days.ceil() as i64)
        .or_else(|| {
            if kind == "trial" {
                response
                    .expires_at
                    .as_deref()
                    .and_then(|expiry| days_until(expiry, now))
            } else {
                None
            }
        });

    Ok(LicenseStatus {
        kind,
        product: response.product.clone().unwrap_or_default(),
        expires_at: response.expires_at.clone(),
        days_left,
        offline: false,
    })
}

// ---------- Startlogik ----------

#[derive(Debug, PartialEq)]
enum Plan {
    ValidateKey(String),
    CheckTrial,
    DetectTrial,
}

fn plan(state: &LocalState) -> Plan {
    match &state.mode {
        Some(Mode::Key(key)) => Plan::ValidateKey(key.clone()),
        Some(Mode::Trial) => Plan::CheckTrial,
        None => Plan::DetectTrial,
    }
}

/// Offline-Fallback: Key-Lizenz 7 Tage nach der letzten erfolgreichen Prüfung,
/// Test nur bis zum gespeicherten Ablauf; nie über ein bekanntes expiresAt hinaus.
fn offline_status(state: &LocalState, now: i64) -> Option<LicenseStatus> {
    let mode = state.mode.as_ref()?;
    let mut status = state.status.clone()?;
    let expiry = state.expires_at.as_deref().and_then(parse_expiry);

    if let Some(expiry) = expiry {
        if now > expiry {
            return None;
        }
    }

    match mode {
        Mode::Trial => {
            expiry?;
        }
        Mode::Key(_) => {
            if now > state.last_ok_at? + OFFLINE_GRACE_SECS {
                return None;
            }
        }
    }

    status.offline = true;
    if let Some(expires_at) = status.expires_at.as_deref() {
        status.days_left = days_until(expires_at, now);
    }
    Some(status)
}

#[derive(Debug, PartialEq)]
enum Resolution {
    Active(LicenseStatus),
    Rejected { reason: String, message: String },
    OfflineExpired,
}

fn is_transient(error: &LicenseError) -> bool {
    match error {
        LicenseError::Rejected { reason, .. } => reason == "rate_limited",
        _ => true,
    }
}

fn resolve(
    result: Result<LicenseStatus, LicenseError>,
    state: &LocalState,
    now: i64,
) -> Resolution {
    match result {
        Ok(status) => Resolution::Active(status),
        Err(LicenseError::Rejected { reason, message }) if reason != "rate_limited" => {
            Resolution::Rejected { reason, message }
        }
        Err(error) => {
            debug_assert!(is_transient(&error));
            match offline_status(state, now) {
                Some(status) => Resolution::Active(status),
                None => Resolution::OfflineExpired,
            }
        }
    }
}

// ---------- Lokaler Zustand ----------

fn state_path(app: &AppHandle) -> Result<PathBuf, LicenseError> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(STATE_FILE))
        .map_err(|error| {
            LicenseError::local(format!("Der Speicherort ist nicht verfügbar: {error}"))
        })
}

fn load_state(app: &AppHandle) -> Result<LocalState, LicenseError> {
    let path = state_path(app)?;
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(serde_json::from_str(&contents).unwrap_or_default()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(LocalState::default()),
        Err(error) => Err(LicenseError::local(format!(
            "Der Lizenzstatus konnte nicht gelesen werden: {error}"
        ))),
    }
}

fn save_state(app: &AppHandle, state: &LocalState) -> Result<(), LicenseError> {
    let path = state_path(app)?;
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory).map_err(|error| {
            LicenseError::local(format!(
                "Der Lizenzordner konnte nicht erstellt werden: {error}"
            ))
        })?;
    }
    let contents = serde_json::to_vec_pretty(state)
        .map_err(|error| LicenseError::local(format!("Lizenzstatus nicht speicherbar: {error}")))?;
    fs::write(path, contents).map_err(|error| {
        LicenseError::local(format!(
            "Der Lizenzstatus konnte nicht gespeichert werden: {error}"
        ))
    })
}

fn clear_state(app: &AppHandle) -> Result<(), LicenseError> {
    match fs::remove_file(state_path(app)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(LicenseError::local(format!(
            "Der lokale Lizenzstatus konnte nicht gelöscht werden: {error}"
        ))),
    }
}

fn remember(
    app: &AppHandle,
    mode: Mode,
    status: &LicenseStatus,
    now: i64,
) -> Result<(), LicenseError> {
    save_state(
        app,
        &LocalState {
            mode: Some(mode),
            last_ok_at: Some(now),
            expires_at: status.expires_at.clone(),
            status: Some(LicenseStatus {
                offline: false,
                ..status.clone()
            }),
        },
    )
}

// ---------- HTTP ----------

fn device_id() -> Result<String, LicenseError> {
    machine_id::machine_id().map_err(LicenseError::local)
}

fn device_name() -> Option<String> {
    hostname::get()
        .ok()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
}

async fn post(endpoint: &str, body: &impl Serialize) -> Result<(u16, String), LicenseError> {
    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| {
            LicenseError::network(format!("Verbindung nicht vorbereitbar: {error}"))
        })?;
    let response = client
        .post(format!("{API_BASE}/api/licenses/{endpoint}"))
        .json(body)
        .send()
        .await
        .map_err(|error| {
            LicenseError::network(format!("Der Lizenzserver ist nicht erreichbar: {error}"))
        })?;
    let status = response.status().as_u16();
    let body = response.text().await.map_err(|error| {
        LicenseError::network(format!(
            "Die Serverantwort konnte nicht gelesen werden: {error}"
        ))
    })?;
    Ok((status, body))
}

async fn call_trial(machine_id: &str, start: bool) -> Result<LicenseStatus, LicenseError> {
    let (status, body) = post(
        "trial",
        &TrialRequest {
            product_id: PRODUCT_ID,
            machine_id: machine_id.to_owned(),
            machine_name: device_name(),
            start,
        },
    )
    .await?;
    to_status(&interpret(status, &body)?, now_secs())
}

async fn call_validate(key: &str, machine_id: &str) -> Result<LicenseStatus, LicenseError> {
    let (status, body) = post(
        "validate",
        &DeviceRequest {
            key: key.to_owned(),
            machine_id: machine_id.to_owned(),
        },
    )
    .await?;
    to_status(&interpret(status, &body)?, now_secs())
}

enum TrialProbe {
    Running,
    Available,
    Used,
    Unknown(LicenseError),
}

async fn probe_trial(machine_id: &str) -> TrialProbe {
    match call_trial(machine_id, false).await {
        Ok(_) => TrialProbe::Running,
        Err(LicenseError::Rejected { reason, .. }) if reason == "no_trial" => TrialProbe::Available,
        Err(LicenseError::Rejected { reason, .. }) if reason == "trial_expired" => TrialProbe::Used,
        Err(error) => TrialProbe::Unknown(error),
    }
}

async fn dialog_state(machine_id: &str, message: Option<String>) -> StartupState {
    let (trial, message) = match probe_trial(machine_id).await {
        TrialProbe::Running => (TrialOffer::Running, message),
        TrialProbe::Available => (TrialOffer::Available, message),
        TrialProbe::Used => (TrialOffer::Used, message),
        TrialProbe::Unknown(error) => {
            let message = message.or_else(|| Some(error.message().to_owned()));
            (TrialOffer::Unknown, message)
        }
    };
    StartupState::Dialog { message, trial }
}

fn offline_expired() -> StartupState {
    StartupState::OfflineExpired {
        message: "Die Lizenz konnte seit längerer Zeit nicht online bestätigt werden. \
                  Bitte stelle eine Internetverbindung her und versuche es erneut."
            .into(),
    }
}

// ---------- Tauri-Commands ----------

#[tauri::command]
pub async fn license_startup(app: AppHandle) -> Result<StartupState, LicenseError> {
    let state = load_state(&app)?;
    let machine_id = device_id()?;
    let now = now_secs();

    match plan(&state) {
        Plan::ValidateKey(key) => {
            let result = call_validate(&key, &machine_id).await;
            match resolve(result, &state, now) {
                Resolution::Active(status) => {
                    if !status.offline {
                        remember(&app, Mode::Key(key), &status, now)?;
                    }
                    Ok(StartupState::Active { status })
                }
                Resolution::Rejected { message, .. } => {
                    clear_state(&app)?;
                    Ok(dialog_state(&machine_id, Some(message)).await)
                }
                Resolution::OfflineExpired => Ok(offline_expired()),
            }
        }
        Plan::CheckTrial => {
            let result = call_trial(&machine_id, true).await;
            match resolve(result, &state, now) {
                Resolution::Active(status) => {
                    if !status.offline {
                        remember(&app, Mode::Trial, &status, now)?;
                    }
                    Ok(StartupState::Active { status })
                }
                Resolution::Rejected { reason, message } if reason == "trial_expired" => {
                    Ok(StartupState::TrialExpired { message })
                }
                Resolution::Rejected { message, .. } => {
                    clear_state(&app)?;
                    Ok(dialog_state(&machine_id, Some(message)).await)
                }
                Resolution::OfflineExpired => Ok(offline_expired()),
            }
        }
        Plan::DetectTrial => match call_trial(&machine_id, false).await {
            Ok(status) => {
                remember(&app, Mode::Trial, &status, now)?;
                Ok(StartupState::Active { status })
            }
            Err(LicenseError::Rejected { reason, .. }) if reason == "no_trial" => {
                Ok(StartupState::Dialog {
                    message: None,
                    trial: TrialOffer::Available,
                })
            }
            Err(LicenseError::Rejected { reason, .. }) if reason == "trial_expired" => {
                Ok(StartupState::Dialog {
                    message: None,
                    trial: TrialOffer::Used,
                })
            }
            Err(error) => Ok(StartupState::Dialog {
                message: Some(error.message().to_owned()),
                trial: TrialOffer::Unknown,
            }),
        },
    }
}

#[tauri::command]
pub async fn license_start_trial(app: AppHandle) -> Result<StartupState, LicenseError> {
    let machine_id = device_id()?;
    match call_trial(&machine_id, true).await {
        Ok(status) => {
            remember(&app, Mode::Trial, &status, now_secs())?;
            Ok(StartupState::Active { status })
        }
        Err(LicenseError::Rejected { reason, message }) if reason == "trial_expired" => {
            Ok(StartupState::TrialExpired { message })
        }
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub async fn license_request_code(key: String, email: String) -> Result<(), LicenseError> {
    let (status, body) = post(
        "request-code",
        &RequestCodeRequest {
            key: key.trim().to_owned(),
            email: email.trim().to_owned(),
        },
    )
    .await?;
    interpret(status, &body).map(|_| ())
}

#[tauri::command]
pub async fn license_activate(
    app: AppHandle,
    key: String,
    email: String,
    code: String,
) -> Result<LicenseStatus, LicenseError> {
    let key = key.trim().to_owned();
    let (status, body) = post(
        "activate",
        &ActivateRequest {
            key: key.clone(),
            machine_id: device_id()?,
            machine_name: device_name(),
            email: email.trim().to_owned(),
            code: code.trim().to_owned(),
        },
    )
    .await?;

    let response = interpret(status, &body).map_err(|error| match error {
        LicenseError::Rejected { reason, message } if reason == "limit_reached" => {
            LicenseError::Rejected {
                message: format!(
                    "{message} Unter „Mein Konto“ im Shop ({API_BASE}/account) kannst du ein altes Gerät freigeben."
                ),
                reason,
            }
        }
        other => other,
    })?;

    let now = now_secs();
    let license = to_status(&response, now)?;
    remember(&app, Mode::Key(key), &license, now)?;
    Ok(license)
}

#[tauri::command]
pub async fn license_deactivate(app: AppHandle) -> Result<(), LicenseError> {
    let state = load_state(&app)?;
    if let Some(Mode::Key(key)) = state.mode {
        let (status, body) = post(
            "deactivate",
            &DeviceRequest {
                key,
                machine_id: device_id()?,
            },
        )
        .await?;
        interpret_deactivate(status, &body)?;
    }
    clear_state(&app)
}

#[tauri::command]
pub fn license_open_page(app: AppHandle, page: String) -> Result<(), LicenseError> {
    let path = match page.as_str() {
        "shop" | "account" => page.as_str(),
        _ => return Err(LicenseError::local("Unbekannte Seite.")),
    };
    app.opener()
        .open_url(format!("{API_BASE}/{path}"), None::<&str>)
        .map_err(|error| {
            LicenseError::local(format!("Der Browser konnte nicht geöffnet werden: {error}"))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_800_000_000;

    fn iso(timestamp: i64) -> String {
        DateTime::from_timestamp(timestamp, 0).unwrap().to_rfc3339()
    }

    fn status(kind: &str, expires_at: Option<String>) -> LicenseStatus {
        LicenseStatus {
            kind: kind.into(),
            product: "Billi".into(),
            expires_at,
            days_left: None,
            offline: false,
        }
    }

    fn state(mode: Mode, last_ok_at: i64, expires_at: Option<String>) -> LocalState {
        let kind = if mode == Mode::Trial {
            "trial"
        } else {
            "subscription"
        };
        LocalState {
            mode: Some(mode),
            last_ok_at: Some(last_ok_at),
            status: Some(status(kind, expires_at.clone())),
            expires_at,
        }
    }

    fn rejected(reason: &str) -> LicenseError {
        LicenseError::Rejected {
            reason: reason.into(),
            message: "msg".into(),
        }
    }

    #[test]
    fn parses_valid_trial_response() {
        let body = r#"{"valid":true,"type":"trial","product":"Billi","productId":1,"startedAt":"2026-10-01T00:00:00Z","expiresAt":"2026-10-15T00:00:00Z","daysLeft":9}"#;
        let status = to_status(&interpret(200, body).unwrap(), NOW).unwrap();
        assert_eq!(status.kind, "trial");
        assert_eq!(status.days_left, Some(9));
        assert_eq!(status.expires_at.as_deref(), Some("2026-10-15T00:00:00Z"));
    }

    #[test]
    fn parses_perpetual_license_with_null_expiry() {
        let body = r#"{"valid":true,"product":"Billi","productId":1,"type":"perpetual","expiresAt":null,"maxActivations":3}"#;
        let status = to_status(&interpret(200, body).unwrap(), NOW).unwrap();
        assert_eq!(status.kind, "perpetual");
        assert_eq!(status.expires_at, None);
        assert_eq!(status.days_left, None);
    }

    #[test]
    fn trial_days_left_is_derived_from_expiry_when_missing() {
        let response = ApiResponse {
            valid: true,
            kind: Some("trial".into()),
            expires_at: Some(iso(NOW + 2 * DAY_SECS + 10)),
            ..Default::default()
        };
        assert_eq!(to_status(&response, NOW).unwrap().days_left, Some(3));
    }

    #[test]
    fn maps_rejections_with_reason_and_message() {
        let body = r#"{"valid":false,"reason":"trial_expired","message":"Vorbei.","expiresAt":"2026-10-15T00:00:00Z"}"#;
        assert_eq!(
            interpret(403, body).unwrap_err(),
            LicenseError::Rejected {
                reason: "trial_expired".into(),
                message: "Vorbei.".into()
            }
        );

        let error = interpret(404, r#"{"valid":false,"reason":"no_trial"}"#).unwrap_err();
        assert_eq!(
            error,
            LicenseError::Rejected {
                reason: "no_trial".into(),
                message: default_message("no_trial").into()
            }
        );
        assert!(matches!(
            interpret(429, r#"{"valid":false,"reason":"rate_limited"}"#),
            Err(LicenseError::Rejected { .. })
        ));
    }

    #[test]
    fn server_errors_and_garbage_are_network_errors() {
        assert!(matches!(
            interpret(500, "<html>oops</html>"),
            Err(LicenseError::Network { .. })
        ));
        assert!(matches!(
            interpret(502, r#"{"valid":false,"reason":"x"}"#),
            Err(LicenseError::Network { .. })
        ));
        assert!(matches!(
            interpret(403, r#"{"valid":false}"#),
            Err(LicenseError::Network { .. })
        ));
    }

    #[test]
    fn request_code_and_deactivate_responses() {
        assert!(interpret(200, r#"{"ok":true}"#).is_ok());
        assert_eq!(interpret_deactivate(200, r#"{"ok":true}"#), Ok(true));
        assert_eq!(interpret_deactivate(404, r#"{"ok":false}"#), Ok(false));
        assert!(interpret_deactivate(500, "boom").is_err());
    }

    #[test]
    fn plan_follows_stored_mode() {
        assert_eq!(plan(&LocalState::default()), Plan::DetectTrial);
        assert_eq!(plan(&state(Mode::Trial, NOW, None)), Plan::CheckTrial);
        assert_eq!(
            plan(&state(Mode::Key("K".into()), NOW, None)),
            Plan::ValidateKey("K".into())
        );
    }

    #[test]
    fn key_grace_period_is_seven_days() {
        let stored = state(Mode::Key("K".into()), NOW, None);
        let within = offline_status(&stored, NOW + 7 * DAY_SECS).unwrap();
        assert!(within.offline);
        assert!(offline_status(&stored, NOW + 7 * DAY_SECS + 1).is_none());
    }

    #[test]
    fn grace_never_exceeds_known_expiry() {
        let stored = state(Mode::Key("K".into()), NOW, Some(iso(NOW + DAY_SECS)));
        assert!(offline_status(&stored, NOW + DAY_SECS - 1).is_some());
        assert!(offline_status(&stored, NOW + DAY_SECS + 1).is_none());
    }

    #[test]
    fn trial_works_offline_only_until_its_expiry() {
        let stored = state(Mode::Trial, NOW, Some(iso(NOW + 3 * DAY_SECS)));
        let status = offline_status(&stored, NOW + DAY_SECS).unwrap();
        assert_eq!(status.days_left, Some(2));
        assert!(offline_status(&stored, NOW + 3 * DAY_SECS + 1).is_none());
        assert!(offline_status(&state(Mode::Trial, NOW, None), NOW).is_none());
    }

    #[test]
    fn resolve_locks_only_on_real_rejections() {
        let stored = state(Mode::Key("K".into()), NOW, None);

        assert!(matches!(
            resolve(Err(rejected("revoked")), &stored, NOW),
            Resolution::Rejected { .. }
        ));
        assert!(matches!(
            resolve(Err(LicenseError::network("offline")), &stored, NOW),
            Resolution::Active(LicenseStatus { offline: true, .. })
        ));
        assert!(matches!(
            resolve(Err(rejected("rate_limited")), &stored, NOW),
            Resolution::Active(LicenseStatus { offline: true, .. })
        ));
        assert_eq!(
            resolve(
                Err(LicenseError::network("offline")),
                &stored,
                NOW + 8 * DAY_SECS
            ),
            Resolution::OfflineExpired
        );
        assert!(matches!(
            resolve(Ok(status("perpetual", None)), &stored, NOW),
            Resolution::Active(LicenseStatus { offline: false, .. })
        ));
    }

    #[test]
    fn local_state_roundtrips_and_tolerates_unknown_content() {
        let stored = state(Mode::Key("K".into()), NOW, Some(iso(NOW)));
        let json = serde_json::to_string(&stored).unwrap();
        assert_eq!(serde_json::from_str::<LocalState>(&json).unwrap(), stored);
        assert_eq!(
            serde_json::from_str::<LocalState>("{}").unwrap(),
            LocalState::default()
        );
    }

    #[test]
    fn parses_date_only_expiry_as_end_of_day() {
        let end = parse_expiry("2026-10-15").unwrap();
        assert_eq!(end, parse_expiry("2026-10-15T23:59:59Z").unwrap());
        assert!(parse_expiry("kein datum").is_none());
    }

    #[test]
    fn startup_state_serializes_for_the_frontend() {
        let json = serde_json::to_value(StartupState::Dialog {
            message: None,
            trial: TrialOffer::Available,
        })
        .unwrap();
        assert_eq!(json["state"], "dialog");
        assert_eq!(json["trial"], "available");

        let json = serde_json::to_value(rejected("revoked")).unwrap();
        assert_eq!(json["kind"], "rejected");
        assert_eq!(json["reason"], "revoked");
    }
}
