use sha2::{Digest, Sha256};

pub fn machine_id() -> Result<String, String> {
    let uid = machine_uid::get()
        .map_err(|error| format!("Die Gerätekennung konnte nicht gelesen werden: {error}"))?;
    Ok(hash_machine_uid(&uid))
}

fn hash_machine_uid(uid: &str) -> String {
    let digest = Sha256::digest(uid.as_bytes());
    format!("{digest:x}")
}

#[cfg(test)]
mod tests {
    use super::{hash_machine_uid, machine_id};

    #[test]
    fn machine_id_is_stable_across_reads_and_is_sha256_hex() {
        let first = machine_id().expect("Gerätekennung muss verfügbar sein");
        let second = machine_id().expect("Gerätekennung muss verfügbar sein");

        assert_eq!(first, second);
        assert_eq!(first.len(), 64);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
    }

    #[test]
    fn hashing_the_same_uid_is_deterministic() {
        let first = hash_machine_uid("stable-device-uid");
        let second = hash_machine_uid("stable-device-uid");

        assert_eq!(first, second);
        assert_eq!(first.len(), 64);
        assert!(first.bytes().all(|byte| byte.is_ascii_hexdigit()));
    }
}
