Systems Analysis and Design — Laboratory 4, Section A
3. Updated ERD and Use Case Diagram
<img width="597" height="376" alt="Screenshot 2026-09-15 110651" src="https://github.com/user-attachments/assets/90dfa09d-3301-4c5c-a1bc-e8e7ee4fdf3e" />
Use Case Diagram

4. Role-Permission Matrix
Function	Administrator	Laboratory Staff	Requester / Viewer
View Available Equipment	✓	✓	✓
Add / Edit / Delete Equipment	✓	✗	✗
Submit Borrowing Request	✓	✓	✓
View Request History	✓	✓	✓ (Own Only)
Approve / Reject Request	✓	✗	✗
Release Approved Equipment	✓	✓	✗
Process Returns	✓	✓	✗
Submit Maintenance Request	✓	✓	✗
Resolve Maintenance Request	✓	✗	✗
Manage Users / Roles	✓	✗	✗
View Audit Logs	✓	✗	✗

5. Workflow Diagram
6. Business Rules
BR-A4-01: Only available equipment may be requested.
BR-A4-02: Staff cannot approve their own request.
BR-A4-03: Only the Administrator may approve or reject borrowing requests.
BR-A4-04: Only approved requests may be released.
BR-A4-05: Released equipment becomes Borrowed.
BR-A4-06: Returned equipment becomes Available unless it is damaged.
BR-A4-07: Rejected requests cannot be released.
BR-A4-08: Returned transactions cannot be processed twice.
BR-A4-09: Equipment under Maintenance cannot be borrowed.
BR-A4-10: Sensitive operations must be recorded in the audit log.

7. Audit-Log Screenshot
8. Functional Test Results
Test ID	Scenario	Expected Result	Result
TC-A4-01	Viewer attempts to open Admin page	Access is denied.	PASS
TC-A4-02	Staff submits a borrowing request	Request is saved as Pending.	PASS
TC-A4-03	Administrator approves a request	Status becomes Approved and audit log is created.	PASS
TC-A4-04	Administrator rejects a request	Status becomes Rejected.	PASS
TC-A4-05	Staff attempts to release a rejected request	Operation is blocked.	PASS
TC-A4-06	Staff releases an approved equipment	Equipment becomes Borrowed.	PASS
TC-A4-07	Staff returns released equipment	Equipment becomes Available or Maintenance if damaged.	PASS
TC-A4-08	Administrator checks audit logs	Approval activity is displayed.	PASS
TC-A4-09	Staff attempts a restricted delete operation	Operation is blocked.	PASS
TC-A4-10	User logs out and accesses a protected page	User is redirected to login or access is denied.	PASS
