# Functional Test Results

| Test ID | Scenario | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| TC-A4-01 | Viewer opens Admin page | Access denied | Access denied by role navigation/RLS | PASS |
| TC-A4-02 | Staff submits request | Saved as Pending | Pending | PASS |
| TC-A4-03 | Administrator approves | Approved + audit log | Approved + audit log | PASS |
| TC-A4-04 | Administrator rejects | Rejected | Rejected | PASS |
| TC-A4-05 | Release rejected request | Operation blocked | Blocked | PASS |
| TC-A4-06 | Release approved equipment | Equipment becomes Borrowed | Borrowed | PASS |
| TC-A4-07 | Return released equipment | Equipment returns to appropriate status | Available when not damaged | PASS |
| TC-A4-08 | Check audit log | Approval entry visible | Visible to administrator | PASS |
| TC-A4-09 | Staff restricted delete | Operation blocked | Blocked by RLS | PASS |
| TC-A4-10 | Logout then protected page | Redirect/access denied | Login required | PASS |
