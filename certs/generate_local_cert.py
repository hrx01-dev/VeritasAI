from pathlib import Path
from datetime import datetime, timedelta, timezone
from ipaddress import ip_address
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

cert_dir = Path('certs')
cert_dir.mkdir(parents=True, exist_ok=True)
key_path = cert_dir / 'localhost-key.pem'
cert_path = cert_dir / 'localhost-cert.pem'

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
subject = issuer = x509.Name([
    x509.NameAttribute(NameOID.COUNTRY_NAME, 'US'),
    x509.NameAttribute(NameOID.ORGANIZATION_NAME, 'VeritasAI Local Dev'),
    x509.NameAttribute(NameOID.COMMON_NAME, 'localhost'),
])

san = x509.SubjectAlternativeName([
    x509.DNSName('localhost'),
    x509.IPAddress(ip_address('127.0.0.1')),
])

cert = (
    x509.CertificateBuilder()
    .subject_name(subject)
    .issuer_name(issuer)
    .public_key(key.public_key())
    .serial_number(x509.random_serial_number())
    .not_valid_before(datetime.now(timezone.utc) - timedelta(days=1))
    .not_valid_after(datetime.now(timezone.utc) + timedelta(days=3650))
    .add_extension(san, critical=False)
    .sign(key, hashes.SHA256())
)

key_path.write_bytes(
    key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    )
)
cert_path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
print(f'Wrote {cert_path} and {key_path}')
