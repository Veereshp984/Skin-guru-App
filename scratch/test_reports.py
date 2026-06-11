import requests
import io
import time
from PIL import Image

def run_tests():
    # Setup sessions
    patient_session = requests.Session()
    doctor_session = requests.Session()
    
    # Port 8000
    base_url = "http://127.0.0.1:8000/api"
    
    # 1. Create a Patient & Doctor user
    # Note: User registration is handled under auth routes. We'll use random emails to ensure unique keys.
    t_id = int(time.time())
    p_email = f"patient_{t_id}@skinguru.com"
    d_email = f"doctor_{t_id}@skinguru.com"
    password = "SecurePassword123!"
    
    # Register Patient
    res_p = patient_session.post(f"{base_url}/auth/register", json={
        "email": p_email,
        "password": password,
        "full_name": "Test Patient",
        "role": "patient"
    })
    print("Patient Registration:", res_p.status_code)
    p_token = res_p.json()["access_token"]
    p_headers = {"Authorization": f"Bearer {p_token}"}
    p_user_id = res_p.json()["user"]["id"]
    
    # Register Doctor
    # Wait, the public register route blocks creating doctors or admins!
    # Let's check routes.py lines 76-80:
    # "If payload.role == UserRole.ADMIN.value: raise HTTP_403" but doesn't block doctor! Let's check if it blocks doctor.
    # Ah! In routes.py:
    # "if payload.role == UserRole.ADMIN.value: raise HTTP_403"
    # So register allows UserRole.DOCTOR! Let's register a doctor.
    res_d = doctor_session.post(f"{base_url}/auth/register", json={
        "email": d_email,
        "password": password,
        "full_name": "Dr. Test Clinician",
        "role": "doctor"
    })
    print("Doctor Registration:", res_d.status_code)
    d_token = res_d.json()["access_token"]
    d_headers = {"Authorization": f"Bearer {d_token}"}
    d_user_id = res_d.json()["user"]["id"]
    
    # 2. Upload prediction as Patient
    img = Image.new('RGB', (28, 28), color = 'blue')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_bytes = img_byte_arr.getvalue()
    
    files = {"file": ("scan.jpg", img_bytes, "image/jpeg")}
    res_scan = patient_session.post(f"{base_url}/predict?model=ensemble", headers=p_headers, files=files)
    print("Patient Scan Status:", res_scan.status_code)
    scan_data = res_scan.json()
    report_id = scan_data["report_id"]
    print("Created Report ID:", report_id)
    
    # 3. Patient lists their own reports
    res_list_p = patient_session.get(f"{base_url}/reports", headers=p_headers)
    print("Patient reports list:", res_list_p.status_code, "Count:", len(res_list_p.json()))
    
    # 4. Doctor lists reports (should see the patient's report)
    res_list_d = doctor_session.get(f"{base_url}/reports", headers=d_headers)
    print("Doctor reports list:", res_list_d.status_code, "Count:", len(res_list_d.json()))
    
    # 5. Patient fetches details
    res_det_p = patient_session.get(f"{base_url}/reports/{report_id}", headers=p_headers)
    print("Patient detail fetch:", res_det_p.status_code)
    
    # 6. Privacy block test: Doctor creates another report, Patient tries to fetch it
    # First Doctor uploads a scan
    files_d = {"file": ("doc_scan.jpg", img_bytes, "image/jpeg")}
    res_scan_d = doctor_session.post(f"{base_url}/predict?model=ensemble", headers=d_headers, files=files_d)
    doc_report_id = res_scan_d.json()["report_id"]
    
    # Patient tries to fetch Doctor's own scan details (which is owned by Doctor)
    res_priv = patient_session.get(f"{base_url}/reports/{doc_report_id}", headers=p_headers)
    print("Privacy Block check (Patient accessing Doctor's report):", res_priv.status_code, "(Should be 403)")
    
    # 7. Doctor reviews Patient's report
    review_payload = {
        "review_input": {
            "comments": "No malignancy detected. Regular mole patterns found. Recommended follow-up in 12 months.",
            "status": "reviewed"
        }
    }
    res_review = doctor_session.patch(f"{base_url}/reports/{report_id}", headers=d_headers, json=review_payload)
    print("Doctor review submit status:", res_review.status_code)
    review_data = res_review.json()
    print("Updated review status:", review_data.get("doctor_review_status"))
    print("Updated comments:", review_data.get("doctor_review", {}).get("comments"))
    
    # 8. Patient downloads generated PDF report
    res_pdf = patient_session.get(f"{base_url}/reports/download/{report_id}", headers=p_headers)
    print("Download PDF status:", res_pdf.status_code, "Content length:", len(res_pdf.content))
    
    # 9. Patient soft-deletes (archives) report
    res_del_p = patient_session.delete(f"{base_url}/reports/{report_id}", headers=p_headers)
    print("Patient soft-delete status:", res_del_p.status_code)
    
    # 10. Patient lists reports again (should be 0 since it is archived)
    res_list_p2 = patient_session.get(f"{base_url}/reports", headers=p_headers)
    print("Patient reports list after archival:", len(res_list_p2.json()))

if __name__ == "__main__":
    run_tests()
