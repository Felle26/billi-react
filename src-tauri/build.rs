use std::{env, path::PathBuf};

fn main() {
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR fehlt"));
    let profile = env::var("PROFILE").unwrap_or_else(|_| "debug".into());
    let env_file = if profile == "release" {
        ".env.production"
    } else {
        ".env.development"
    };
    let env_path = manifest_dir.join(env_file);

    println!("cargo:rerun-if-changed={}", env_path.display());
    println!("cargo:rerun-if-env-changed=LICENSE_API_BASE");

    if env_path.exists() {
        dotenvy::from_path(&env_path).unwrap_or_else(|error| {
            panic!(
                "{} konnte nicht geladen werden: {error}",
                env_path.display()
            )
        });
    }

    let base_url = env::var("LICENSE_API_BASE")
        .unwrap_or_else(|_| "http://localhost:3000".into())
        .trim_end_matches('/')
        .to_owned();

    if profile == "release" && !base_url.starts_with("https://") {
        panic!("LICENSE_API_BASE muss für Release-Builds eine HTTPS-URL sein");
    }
    if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
        panic!("LICENSE_API_BASE muss mit http:// oder https:// beginnen");
    }

    println!("cargo:rustc-env=LICENSE_API_BASE={base_url}");
    tauri_build::build()
}
