# Cursor Bot Dashboard

Dashboard para medir la adopción del Cursor Bot en los squads de Humand, sprint a sprint.

Carga datos directamente desde Jira en tiempo real. Sin build step — funciona con GitHub Pages.

---

## Antes de publicar: configurar el token de Jira

El archivo `index.html` tiene esta línea cerca del principio del `<script>`:

```js
token: 'Basic REEMPLAZAR_CON_TOKEN_BASE64',
```

### Pasos para generar el token:

1. Ir a **https://id.atlassian.com/manage-profile/security/api-tokens**
2. Click en **"Create API token"** → ponerle un nombre (ej. "Cursor Bot Dashboard") → copiar el token
3. Abrir Chrome → F12 → **Console** → ejecutar:
   ```js
   btoa('tu-email@humand.co:EL_TOKEN_COPIADO')
   ```
4. Copiar el resultado (es una cadena larga de letras y números)
5. En `index.html`, reemplazar `REEMPLAZAR_CON_TOKEN_BASE64` con ese resultado:
   ```js
   token: 'Basic dGVzdEBodW1hbmQuY28....',
   ```
6. Guardar el archivo y subir al repo

---

## Publicar en GitHub Pages

1. Crear un repo **privado** en GitHub
2. Subir el código:
   ```bash
   git init
   git add .
   git commit -m "feat: cursor bot dashboard"
   git remote add origin https://github.com/tu-usuario/nombre-repo.git
   git push -u origin main
   ```
3. En GitHub → **Settings** → **Pages** → Source: **Deploy from branch** → Branch: `main` → Folder: `/ (root)` → Save
4. En ~1 minuto el dashboard estará disponible en la URL que muestra GitHub Pages (algo como `https://tu-usuario.github.io/nombre-repo/`)

---

## Cómo se actualiza

Los datos son **en tiempo real**: cada vez que alguien abre el dashboard, se conecta a Jira y trae los datos más recientes. No hay que hacer nada manualmente.

El token vence si lo revocás o si pasa más de 1 año sin uso. Si el dashboard deja de cargar, seguir los pasos de arriba para renovarlo.

---

## Squads monitoreados

`SQZB` `SQSQ` `SQSH` `SQRN` `SQRC` `SQPM` `SQPD` `SQOW` `SQOT` `SQKA` `SQJG` `SQGZ` `SQEG` `SQDP` `SQXS` `SQCY` `SQWH`

## Criterio de tasks del bot

Se cuentan tickets de tipo **Subtask**, **Sub-task** o **Dev Task**, estado **Done**, asignados a **Cursor Bot**. El período arranca desde el sprint iniciado el **24 de Febrero de 2025**.

La adopción se calcula como: `tasks del bot / total tasks del mismo tipo en ese sprint × 100`.
