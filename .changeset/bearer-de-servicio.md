---
"@eva_solutions/whatsapp-sdk": major
---

**Cambio incompatible.** `./internal` y `./admin` dejan de firmar con HMAC S2S y se autentican con un token Bearer de servicio emitido por Auth (identidad fase 1).

- `crearClienteInterno` y `crearClienteAdmin` reciben `obtenerToken: () => Promise<string>` e `invalidarToken?: (tokenRechazado: string) => void` en lugar de `clientId` y `secretoHex`, y envían `Authorization: Bearer <token>`. El SDK no depende del auth-sdk: el consumidor pasa su proveedor de tokens.
- Ante un `401` se invoca `invalidarToken(tokenRechazado)` (puede ser directamente `proveedor.invalidate` del auth-sdk) y la request se reintenta **una sola vez**, también los `POST` (el `401` significa que la API no procesó la request). Sin `invalidarToken` no hay reintento. Un segundo `401` se devuelve como error. Si `obtenerToken` o `invalidarToken` lanzan, el SDK devuelve un `Resultado` de falla (el `500` local expone solo un `code` OAuth no sensible en `detalles`).
- `./admin` `serviceClients` refleja el registro local de Whatsapp-api sin secreto ni permisos: `ServiceClient` = `{ id, clientId, name, enabled, allowedSourcePhones, createdAt, updatedAt }`, donde `id` es el `sub` del token (uuid de Auth) y `clientId` el slug informativo. Las rutas y los inputs se identifican por `id` (antes `slug`). Se retiran `rotarSecret`, `secret` y `scopes`.
- Se retiran `crearHttpClientS2S`, `OpcionesClienteS2S`, la firma HMAC y `soportaMultipart`. Nuevos: `crearHttpClientConToken` y `OpcionesClienteConToken` (exportados por `./admin` e `./internal`).
- Un `403` en `./internal` indica permiso insuficiente en el token, `sub` sin registro habilitado o `sourcePhone` fuera de la allowlist; un `401`, token inválido o vencido.
