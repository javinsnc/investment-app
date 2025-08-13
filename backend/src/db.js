const { Pool } = require("pg");

// ===== 1) Pega aquí el CA como en el ejemplo de Aiven =====
//    - Puedes pegar uno o varios bloques (intermedio + raíz), uno detrás de otro.
//    - Si lo dejas vacío, intentaremos PGSSL_CA_PEM o PGSSL_CA_BASE64.
const INLINE_CA_PEM = `-----BEGIN CERTIFICATE-----
MIIEUDCCArigAwIBAgIUb+B3mP0cZvN1i9i/XY6pkyJ+aZcwDQYJKoZIhvcNAQEM
BQAwQDE+MDwGA1UEAww1MmFhYTExZGEtZmUyYy00ZjAxLWFkMzYtZmQ4MjJmNTc5
MGI3IEdFTiAxIFByb2plY3QgQ0EwHhcNMjUwODEyMTkwMTIzWhcNMzUwODEwMTkw
MTIzWjBAMT4wPAYDVQQDDDUyYWFhMTFkYS1mZTJjLTRmMDEtYWQzNi1mZDgyMmY1
NzkwYjcgR0VOIDEgUHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCC
AYoCggGBAK/EUcNbKrD574XPMwIKZh5clZmzCJDpSsFNvzXO/8PLPYHo7+yN2upk
uDyfJVc7tMZNrbsHbZrkPqLIBoNIhnHGKi9jlgzTQJeFnrYrBX+B9jo0e+7+1QqZ
Q8l1fhub1ULWWRBiKnMyKmy+CvYpL35lPTIFbo+G31m92QvT6G2KUNV8c/w4iHzt
4I5K36Et7C/qGe1g92n1VsDij8xz8XpKppWsbRw/zPTAwZ2Nlx6DZWvNXnjFgcRm
Lcf2THSxpt5rUr97X6N9thY73nFzrhlsjZM1+UXz0lM1pdJCef/73oDalqo+AjVl
zCRHHhMzdU+dQCpJi8SIR6l26pX43HpqaRRq8hllRD6hVbCX7racpK7WEVlf+nWX
j3AVmolMchR6+6U/q6GDyyXcPGC0hajBRQwWFlSdT8A2PwT+pu/3ELMZUJdSmp2Z
MrsY1zZq9pz+OR4g+7SrapaQYkL8ENpUFy/JZBY1H5E7p91o5R443pCMB/LBl6R+
FwHQBdzIiQIDAQABo0IwQDAdBgNVHQ4EFgQUgdqpY8fVlnqKZU3di4Dv35rhmLIw
EgYDVR0TAQH/BAgwBgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQAD
ggGBAGGlGmTtQ2rRgRPz+XMIGZSECS8JZ9MtZ/U6BRMoe0eBe8pJhZsXRuEs+7LZ
OWvC8AVDp1yuf58IsYnEiOsdeItuZPVlJ4uPVE8cZzhl9+aACP4oTendirhBbXvI
tY63c2F7VtmK1RWcMWlEPVFXWt3Pky1BXJSx0fELdnPS3HGFgL4qzsK2FrZRDZAa
UZIKLcJbyn0kJ4IPswQV2+NLgAHw0XsJWnobHtJAsPHw9pipuUya7lP4qwiG/Yim
ev4d5sKMI4Q0quv5keEArNzMrUcT8sXI8yYUoomRQtq42qqrIKln0Rk6WMeGVIbI
4JSSJI/srGDnbCr9goBKtZLRZ1OnomVObJOWW88ELLur60FEDypbKNYtq302mwOO
tHETPWkkyvbwMDxWrg68w2TjFpvCivKqGtzq6XygvsGjRpemsr9c8B3GahyYLYGR
EsA4atIwUqlzLaSn6ExhBOQQo0VoWzQF7b3+aH44MGKw7+AWMlVI1rf1wtKiscas
wFQWYA==
-----END CERTIFICATE-----`;

// ===== 2) Helpers mínimos (solo para completar el CA si no lo pegas inline) =====
function readCaFromEnvFallback() {
    const pem = process.env.PGSSL_CA_PEM;
    if (pem && pem.includes("-----BEGIN CERTIFICATE-----")) return pem;
    const b64 = process.env.PGSSL_CA_BASE64 || process.env.PGSSL_CA_PEM_BASE64;
    if (b64) {
        try {
            const decoded = Buffer.from(b64, "base64").toString("utf8");
            if (decoded.includes("-----BEGIN CERTIFICATE-----")) return decoded;
        } catch (_) {}
    }
    return null;
}

function parseDbUrl(u) {
    try {
        const x = new URL(u);
        return {
            user: decodeURIComponent(x.username || ""),
            password: decodeURIComponent(x.password || ""),
            host: x.hostname,
            port: x.port ? Number(x.port) : undefined,
            database: x.pathname ? x.pathname.replace(/^\//, "") : undefined,
        };
    } catch {
        return {};
    }
}

// ===== 3) Construcción del config al estilo Aiven =====
const parsed = process.env.DATABASE_URL ? parseDbUrl(process.env.DATABASE_URL) : {};

const user = process.env.PGUSER || parsed.user || "avnadmin";
const password = process.env.PGPASSWORD || parsed.password || "";
const host = process.env.PGHOST || parsed.host || "investment-app-db-javinsnc-e97f.c.aivencloud.com";
const port = Number(process.env.PGPORT) || parsed.port || 5432;
const database = process.env.PGDATABASE || parsed.database || "defaultdb";

// CA: primero el inline como en la guía de Aiven; si está vacío, intenta fallback por env.
let ca = INLINE_CA_PEM && INLINE_CA_PEM.includes("-----BEGIN CERTIFICATE-----") ? INLINE_CA_PEM : null;
if (!ca) {
    const fb = readCaFromEnvFallback();
    if (fb) ca = fb;
}
if (!ca) {
    throw new Error(
        "No CA provided. Paste your Aiven CA into INLINE_CA_PEM (db.js) o define PGSSL_CA_PEM / PGSSL_CA_BASE64 en Render."
    );
}

const config = {
    user,
    password,
    host,
    port,
    database,
    ssl: {
        rejectUnauthorized: true,
        ca,
    },
};

console.log("Config is ${JSON.stringify(config, null, 2)}");

// ===== 4) Pool y export =====
const pool = new Pool(config);

pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
