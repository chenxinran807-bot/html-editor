# Native evidence availability

The initial native generation completed successfully and emitted its event stream to standard output. That original NDJSON stream was not persisted as a file during the run and is no longer available as independently verifiable raw evidence. It is therefore not reconstructed or represented as an original event envelope here.

The later read-only native asset query remains available. `asset-report.sanitized.json` is a field-level sanitized projection of that real CLI response and retains the asset identifiers, six `fileAssets` references, 16 capture-state entries and their independently countable structure. Identity fields, credentials, export instructions and unnecessary signed/content delivery fields are omitted.

`generation.sanitized.json` preserves the originally observed generation outcome and skill trace, but it is a compact derived record rather than raw NDJSON. This evidence compression limits auditability of intermediate CLI events even though the final remote asset and browser behavior remain directly verifiable.
