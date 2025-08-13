const { Pool } = require("pg");
const fs = require("fs");
const { URL } = require("url");

/**
 * 1) PRIMERA OPCIÓN (prioridad): CA embebido en código para pruebas rápidas.
 *    - Sustituye el marcador por el/los bloques PEM completos.
 *    - Puedes pegar varios certificados (intermedios + raíz), uno detrás de otro.
 *    - Si lo dejas vacío, se usarán las otras fuentes (env/file) como fallback.
 */
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

/**
 * Normaliza el PEM (maneja \n escapados, CRLF, múltiples bloques).
 */
function normalizePem(pem) {
    if (!pem) return null;
    let s = String(pem).trim();
    if (s.includes("\\n") && !s.includes("\n")) s = s.replace(/\\n/g, "\n");
    s = s.replace(/\r\n/g, "\n");
    const blocks = s
        .split(/(?=-----BEGIN CERTIFICATE-----)/g)
        .map(b => b.trim())
        .filter(b => b.startsWith("-----BEGIN CERTIFICATE-----") && b.endsWith("-----END CERTIFICATE-----"));
    return blocks.length ? blocks.join("\n") : null;
}

/**
 * Lee CA desde variables/ruta (fallback si no usamos INLINE_CA_PEM).
 */
function readCaFromEnv() {
    // 1) PEM directo (multilínea)
    const pem = normalizePem(process.env.PGSSL_CA_PEM);
    if (pem) return pem;

    // 2) Base64 (una sola línea)
    const b64 = process.env.PGSSL_CA_BASE64 || process.env.PGSSL_CA_PEM_BASE64;
    if (b64) {
        try {
            const decoded = normalizePem(Buffer.from(b64, "base64").toString("utf8"));
            if (decoded) return decoded;
        } catch (_) {}
    }

    // 3) Ruta de fichero (Secret File de Render u otras rutas)
    const caPath = process.env.PGSSL_CA || process.env.PGSSLROOTCERT || "/etc/secrets/aiven-ca.pem";
    try {
        const filePem = normalizePem(fs.readFileSync(caPath, "utf8"));
        if (filePem) return filePem;
    } catch (_) {}

    return null;
}

function getHostFromUrl(u) {
    try { return new URL(u).hostname; } catch { return null; }
}

function buildConfig() {
    const url = process.env.DATABASE_URL;
    const cfg = url
        ? { connectionString: url }
        : {
            host: process.env.PGHOST || "db",
            port: Number(process.env.PGPORT) || 5432,
            user: process.env.PGUSER || "app",
            password: process.env.PGPASSWORD || "app",
            database: process.env.PGDATABASE || "appdb",
        };

    // SNI (debe coincidir con CN/SAN del certificado)
    const hostForSNI = (url && getHostFromUrl(url)) || process.env.PGHOST || undefined;

    // === PRIORIDAD 1: CA embebido en código ===
    const inline = normalizePem(INLINE_CA_PEM);
    if (inline && inline.includes("BEGIN CERTIFICATE")) {
        const caArray = inline
            .split(/(?=-----BEGIN CERTIFICATE-----)/g)
            .map(s => s.trim())
            .filter(Boolean);
        cfg.ssl = {
            rejectUnauthorized: true,
            ca: caArray, // soporta cadena (intermedios + raíz)
            ...(hostForSNI ? { servername: hostForSNI } : {}),
        };
        return cfg;
    }

    // === PRIORIDAD 2: CA desde env/ruta (fallback) ===
    const caPem = readCaFromEnv();
    if (caPem) {
        const caArray = caPem
            .split(/(?=-----BEGIN CERTIFICATE-----)/g)
            .map(s => s.trim())
            .filter(Boolean);
        cfg.ssl = {
            rejectUnauthorized: true,
            ca: caArray,
            ...(hostForSNI ? { servername: hostForSNI } : {}),
        };
        return cfg;
    }

    // === PRIORIDAD 3: sslmode=require en la URL => SSL sin verificación (escape temporal) ===
    if (url && /sslmode=require/i.test(url)) {
        cfg.ssl = { rejectUnauthorized: false, ...(hostForSNI ? { servername: hostForSNI } : {}) };
        return cfg;
    }

    // Sin SSL por defecto (si nada lo pide)
    return cfg;
}

const pool = new Pool(buildConfig());

pool.on("error", (err) => {
    console.error("Postgres pool error:", err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool,
};
