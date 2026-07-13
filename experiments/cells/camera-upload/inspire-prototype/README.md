# camera-upload × inspire-prototype

Native Inspire experiment completed with a remote React prototype.

- Result: `PASS_WITH_CONCERNS` — 80/100
- Remote asset: `6a54dba21afe4f0267392504`
- Preview: https://6a54dba21afe4f0267392504-prototype.inspire.bytedance.net
- Generation: successful; compile errors 0; runtime errors 0; platform captures 16/16
- Browser QA: 9 of 10 contracted tasks passed; success and service-error states were also exercised

The strongest result is the breadth of the simulated mobile flow: camera facing, album round trip, confirmation, moderation, success, failure, and service-error states are all reachable. The material defect is recovery: “重新上传” does not restart the flow from either failure result. Visual fidelity is also limited by generic remote placeholder photography rather than clear reuse of the supplied references.

Evidence is organized under `run/` and `qa/`. The native deliverable is the remote asset described in `artifact/remote-asset.json`; no locally reconstructed prototype was substituted.
