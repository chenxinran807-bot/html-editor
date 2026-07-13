# camera-upload × inspire-prototype

Native Inspire experiment completed with a remote React prototype.

- Result: `PASS_WITH_CONCERNS` — 74/100
- Remote asset: `6a54dba21afe4f0267392504`
- Preview: https://6a54dba21afe4f0267392504-prototype.inspire.bytedance.net
- Generation: successful; compile errors 0; runtime errors 0; platform captures 16/16
- Browser QA: 9 of 10 contracted tasks passed; success and service-error states were also exercised

The strongest result is the breadth of the simulated mobile flow: camera facing, album round trip, confirmation, moderation, success, failure, and service-error states are all reachable. The material contract defect is recovery: both “重新上传” controls are dead for their stated purpose, so neither review failure nor service error can restart capture. Visual fidelity is further limited by food, landscape and generic-person placeholder photography that conflicts with the clear single-person frontal-face objective and does not clearly reuse the supplied references.

Evidence is organized under `run/` and `qa/`. The native deliverable is the remote asset described in `artifact/remote-asset.json`; no locally reconstructed prototype was substituted. The original generation NDJSON was not persisted, so event-level evidence is compressed: the repository contains a real field-level sanitized asset-query report and a derived generation summary, with that limitation explicitly disclosed.
