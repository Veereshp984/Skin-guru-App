import requests
from PIL import Image
import io

def run_reviews_test():
    session_pat = requests.Session()
    session_doc_a = requests.Session()
    session_doc_b = requests.Session()
    session_admin = requests.Session()

    # User payloads
    pat_email = "test_review_patient@skinguru.com"
    doc_a_email = "test_review_doc_a@skinguru.com"
    doc_b_email = "test_review_doc_b@skinguru.com"
    admin_email = "test_review_admin@skinguru.com"
    password = "TestPassword123!"

    # 1. Setup Auth tokens for all roles
    def get_token(session, email, full_name, role):
        res = session.post("http://127.0.0.1:8000/api/auth/login", json={"email": email, "password": password})
        if res.status_code != 200:
            reg_role = "patient" if role == "admin" else role
            reg_payload = {"email": email, "password": password, "full_name": full_name, "role": reg_role}
            res = session.post("http://127.0.0.1:8000/api/auth/register", json=reg_payload)
            assert res.status_code == 201, f"Failed to register {role}: {res.text}"
            
        from backend.app.config import MONGODB_URI, MONGODB_DB_NAME
        from pymongo import MongoClient
        client = MongoClient(MONGODB_URI)
        db = client[MONGODB_DB_NAME]
        db.users.update_one({"email": email}, {"$set": {"role": role}})
        
        res = session.post("http://127.0.0.1:8000/api/auth/login", json={"email": email, "password": password})
        assert res.status_code == 200, f"Login failed for {role}: {res.text}"
        return res.json()["access_token"]

    pat_token = get_token(session_pat, pat_email, "Test Patient", "patient")
    doc_a_token = get_token(session_doc_a, doc_a_email, "Dr. Alice", "doctor")
    doc_b_token = get_token(session_doc_b, doc_b_email, "Dr. Bob", "doctor")
    admin_token = get_token(session_admin, admin_email, "Platform Admin", "admin")

    # Fetch Doctor A and B user IDs from profile
    res = session_doc_a.get("http://127.0.0.1:8000/api/auth/me", headers={"Authorization": f"Bearer {doc_a_token}"})
    doc_a_id = res.json()["id"]

    res = session_doc_b.get("http://127.0.0.1:8000/api/auth/me", headers={"Authorization": f"Bearer {doc_b_token}"})
    doc_b_id = res.json()["id"]

    # 2. Patient submits a scan
    img = Image.new('RGB', (28, 28), color='green')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    files = {"file": ("scan_review.jpg", img_byte_arr.getvalue(), "image/jpeg")}
    
    res = session_pat.post(
        "http://127.0.0.1:8000/api/predict?model=ensemble",
        headers={"Authorization": f"Bearer {pat_token}"},
        files=files
    )
    assert res.status_code == 200, f"Predict failed: {res.text}"
    report_id = res.json()["report_id"]
    print(f"1. AI Scan created. Report ID: {report_id}")

    # 3. Patient requests review
    req_payload = {"report_id": report_id, "doctor_id": doc_a_id}
    res = session_pat.post(
        "http://127.0.0.1:8000/api/reviews/request",
        headers={"Authorization": f"Bearer {pat_token}"},
        json=req_payload
    )
    assert res.status_code == 201, f"Review request failed: {res.text}"
    review_data = res.json()
    review_id = review_data["review_id"]
    print(f"2. Patient requested review. Review ID: {review_id}")

    # Verify report status is pending
    res = session_pat.get(f"http://127.0.0.1:8000/api/reports/{report_id}", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.json().get("doctor_review_status") == "pending"

    # 4. Attempt duplicate request -> Should fail
    res = session_pat.post(
        "http://127.0.0.1:8000/api/reviews/request",
        headers={"Authorization": f"Bearer {pat_token}"},
        json=req_payload
    )
    assert res.status_code == 400, "Duplicate request allowed!"
    print("3. Duplicate request prevention works (400 Bad Request).")

    # 5. Patient attempts to claim review -> Should fail with 403
    res = session_pat.patch(
        f"http://127.0.0.1:8000/api/reviews/{review_id}/status",
        headers={"Authorization": f"Bearer {pat_token}"},
        json={"status": "accepted"}
    )
    assert res.status_code == 403, "Patient allowed to claim review!"
    print("4. RBAC security works: Patient blocked from claims (403 Forbidden).")

    # 6. Doctor A claims the case
    res = session_doc_a.patch(
        f"http://127.0.0.1:8000/api/reviews/{review_id}/status",
        headers={"Authorization": f"Bearer {doc_a_token}"},
        json={"status": "accepted"}
    )
    assert res.status_code == 200, f"Doctor A claim failed: {res.text}"
    assert res.json()["status"] == "accepted"
    print("5. Doctor A successfully claimed case (status: accepted).")

    # Verify report status updated in predictions
    res = session_pat.get(f"http://127.0.0.1:8000/api/reports/{report_id}", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.json().get("doctor_review_status") == "accepted"

    # 7. Doctor B tries to submit diagnosis for the case claimed by Doctor A -> Should fail with 403
    diag_payload = {
        "doctor_diagnosis": "Mild Eczema",
        "doctor_notes": "Lesion shows signs of dry scaling.",
        "recommendations": "Apply moisturizing cream twice daily.",
        "status": "reviewed"
    }
    res = session_doc_b.patch(
        f"http://127.0.0.1:8000/api/reviews/{review_id}",
        headers={"Authorization": f"Bearer {doc_b_token}"},
        json=diag_payload
    )
    assert res.status_code == 403, "Doctor B allowed to edit Doctor A's case!"
    print("6. RBAC security works: Doctor B blocked from unauthorized edits (403 Forbidden).")

    # 8. Doctor A submits final consultation review
    res = session_doc_a.patch(
        f"http://127.0.0.1:8000/api/reviews/{review_id}",
        headers={"Authorization": f"Bearer {doc_a_token}"},
        json=diag_payload
    )
    assert res.status_code == 200, f"Doctor A submit review failed: {res.text}"
    assert res.json()["status"] == "reviewed"
    print("7. Doctor A submitted finalized diagnosis (status: reviewed).")

    # 9. Verify report details contains diagnostic inputs and audit log
    res = session_pat.get(f"http://127.0.0.1:8000/api/reports/{report_id}", headers={"Authorization": f"Bearer {pat_token}"})
    report = res.json()
    assert report.get("doctor_review_status") == "reviewed"
    assert report.get("doctor_review") is not None
    assert "Mild Eczema" in report["doctor_review"]["comments"]
    
    audit_trail = report.get("audit_trail", [])
    assert any("Mild Eczema" in entry["details"] for entry in audit_trail)
    print("8. Report document correctly synced diagnostic sign-offs and audit logs.")

    # 10. Admin stats verification
    res = session_admin.get("http://127.0.0.1:8000/api/reviews/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    print("Admin stats response code:", res.status_code)
    print("Admin stats response text:", res.text)
    assert res.status_code == 200
    stats = res.json()
    print("9. Admin dashboard statistics received:", stats)
    assert stats["completed"] >= 1, "Completed statistics not incremented!"

    print("\n--- ALL REVIEW CONSULTATION TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_reviews_test()
