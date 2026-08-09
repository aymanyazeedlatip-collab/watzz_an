# WATTZAN Vercel `includeFiles` Fix

## Error fixed

Vercel rejected the original configuration with:

```text
Invalid request: `functions.backend/server.py.includeFiles` should be string.
```

The previous `vercel.json` used an array:

```json
"includeFiles": [
  "backend/artifacts/municipality_v1/**",
  "backend/data/default/**",
  "backend/app/config/**"
]
```

Vercel requires one glob string. The corrected form is:

```json
"includeFiles": "{backend/artifacts/municipality_v1/**,backend/data/default/**,backend/app/config/**}"
```

## Apply to an existing GitHub repository

1. Replace the repository-root `vercel.json` with the corrected file in this package.
2. Commit the change.
3. Push it to GitHub.
4. Vercel should automatically create a new deployment.
5. If it does not, open the latest Vercel deployment and select **Redeploy**.

No Python, frontend, forecasting, model, chatbot, or database code was changed.
