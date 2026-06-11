import requests
from PIL import Image
import io
import time

def run_analytics_test():
    session_pat = requests.Session()
    session_doc = requests.Session()
    session_admin = requests.Session()

    # User payloads
    pat_email = "test_analytics_patient@skinguru.com"
    doc_email = "test_analytics_doc@skinguru.com"
    admin_email = "test_analytics_admin@skinguru.com"
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

    pat_token = get_token(session_pat, pat_email, "Analytics Patient", "patient")
    doc_token = get_token(session_doc, doc_email, "Dr. Alice Analytics", "doctor")
    admin_token = get_token(session_admin, admin_email, "Platform Admin Analytics", "admin")

    print("Tokens acquired. Testing RBAC controls...")

    # 2. Test RBAC: Patients calling Admin analytics -> 403
    res = session_pat.get("http://127.0.0.1:8000/api/analytics/admin", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.status_code == 403, f"Expected 403 Forbidden for patient on admin endpoint, got {res.status_code}"
    print("[OK] Patient blocked from Admin Analytics.")
    
    # 3. Test RBAC: Patients calling Doctor analytics -> 403
    res = session_pat.get("http://127.0.0.1:8000/api/analytics/doctor", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.status_code == 403, f"Expected 403 Forbidden for patient on doctor endpoint, got {res.status_code}"
    print("[OK] Patient blocked from Doctor Analytics.")
    
    # 4. Test RBAC: Doctors calling Admin analytics -> 403
    res = session_doc.get("http://127.0.0.1:8000/api/analytics/admin", headers={"Authorization": f"Bearer {doc_token}"})
    assert res.status_code == 403, f"Expected 403 Forbidden for doctor on admin endpoint, got {res.status_code}"
    print("[OK] Doctor blocked from Admin Analytics.")
    
    # 5. Test Access: Patient accesses Patient analytics -> 200
    res = session_pat.get("http://127.0.0.1:8000/api/analytics/patient", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.status_code == 200, f"Expected 200 for patient analytics, got {res.status_code}: {res.text}"
    patient_initial_data = res.json()
    print(f"[OK] Patient Analytics accessed successfully. Total initial scans: {patient_initial_data['summary']['total_scans']}")
    
    # 6. Test Access: Doctor accesses Doctor analytics -> 200
    res = session_doc.get("http://127.0.0.1:8000/api/analytics/doctor", headers={"Authorization": f"Bearer {doc_token}"})
    assert res.status_code == 200, f"Expected 200 for doctor analytics, got {res.status_code}: {res.text}"
    print("[OK] Doctor Analytics accessed successfully.")
    
    # 7. Test Access: Admin accesses Admin analytics -> 200
    res = session_admin.get("http://127.0.0.1:8000/api/analytics/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200, f"Expected 200 for admin analytics, got {res.status_code}: {res.text}"
    admin_initial_data = res.json()
    print(f"[OK] Admin Analytics accessed successfully. Total registered users: {admin_initial_data['summary']['total_users']}")
    
    # 8. Test Cache Eviction & Real-time Update: Upload a new prediction and check if scan counts update immediately
    img = Image.new('RGB', (28, 28), color='blue')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    files = {"file": ("scan_analytics_test.jpg", img_byte_arr.getvalue(), "image/jpeg")}
    
    print("Submitting a new AI prediction scan...")
    res = session_pat.post(
        "http://127.0.0.1:8000/api/predict?model=ensemble",
        headers={"Authorization": f"Bearer {pat_token}"},
        files=files
    )
    assert res.status_code == 200, f"Predict failed: {res.text}"
    print("[OK] AI Scan submitted.")
    
    # Fetch patient analytics again
    res = session_pat.get("http://127.0.0.1:8000/api/analytics/patient", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.status_code == 200
    patient_new_data = res.json()
    print(f"[OK] Patient scans updated: {patient_initial_data['summary']['total_scans']} -> {patient_new_data['summary']['total_scans']}")
    assert patient_new_data['summary']['total_scans'] == patient_initial_data['summary']['total_scans'] + 1, "Cache eviction failed! Scan count did not increment."
    
    # Fetch admin analytics again
    res = session_admin.get("http://127.0.0.1:8000/api/analytics/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200
    admin_new_data = res.json()
    print(f"[OK] Admin scans updated: {admin_initial_data['summary']['total_scans']} -> {admin_new_data['summary']['total_scans']}")
    assert admin_new_data['summary']['total_scans'] == admin_initial_data['summary']['total_scans'] + 1, "Cache eviction failed for admin! Scan count did not increment."
    
    # 9. Test General routes: diseases and trends
    res = session_pat.get("http://127.0.0.1:8000/api/analytics/diseases", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.status_code == 200, f"Diseases endpoint failed: {res.text}"
    print("[OK] Diseases analytics retrieved successfully.")
    
    res = session_pat.get("http://127.0.0.1:8000/api/analytics/trends", headers={"Authorization": f"Bearer {pat_token}"})
    assert res.status_code == 200, f"Trends endpoint failed: {res.text}"
    print("[OK] Trends analytics retrieved successfully.")

    print("\n==============================")
    print("ALL ANALYTICS TESTS PASSED!")
    print("==============================\n")

if __name__ == "__main__":
    run_analytics_test()
