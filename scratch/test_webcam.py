import requests
from PIL import Image
import io

def run_webcam_test():
    session = requests.Session()
    email = "test_scanner_user@skinguru.com"
    password = "TestPassword123!"
    
    # 1. Login or register test user
    login_payload = {"email": email, "password": password}
    res = session.post("http://127.0.0.1:8000/api/auth/login", json=login_payload)
    if res.status_code != 200:
        register_payload = {
            "email": email,
            "password": password,
            "full_name": "Test Scanner User",
            "role": "patient"
        }
        res = session.post("http://127.0.0.1:8000/api/auth/register", json=register_payload)
        assert res.status_code == 201, f"Failed to register user: {res.text}"
        token = res.json()["access_token"]
    else:
        token = res.json()["access_token"]
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Generate dummy image
    img = Image.new('RGB', (28, 28), color = 'blue')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_bytes = img_byte_arr.getvalue()
    
    # 3. Call predict API with source=webcam
    files = {"file": ("scan_test.jpg", img_bytes, "image/jpeg")}
    res = session.post(
        "http://127.0.0.1:8000/api/predict?model=ensemble&source=webcam", 
        headers=headers, 
        files=files
    )
    assert res.status_code == 200, f"Predict failed: {res.text}"
    pred_data = res.json()
    report_id = pred_data["report_id"]
    print(f"Prediction success. Report ID: {report_id}")
    
    # 4. Fetch prediction details and assert capture_source is webcam
    res = session.get(f"http://127.0.0.1:8000/api/predictions/{report_id}", headers=headers)
    assert res.status_code == 200, f"Get prediction failed: {res.text}"
    record = res.json()
    print("Prediction record capture_source:", record.get("capture_source"))
    assert record.get("capture_source") == "webcam", "capture_source is not 'webcam' in predictions route!"
    
    # 5. Fetch report details and assert capture_source and audit trail
    res = session.get(f"http://127.0.0.1:8000/api/reports/{report_id}", headers=headers)
    assert res.status_code == 200, f"Get report failed: {res.text}"
    report = res.json()
    print("Report record capture_source:", report.get("capture_source"))
    assert report.get("capture_source") == "webcam", "capture_source is not 'webcam' in reports route!"
    
    audit_trail = report.get("audit_trail", [])
    print("Audit trail details:", audit_trail[0]["details"] if audit_trail else "No audit trail")
    assert any("via webcam" in entry["details"] for entry in audit_trail), "Audit trail details did not log 'via webcam'!"
    
    print("\n--- ALL TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_webcam_test()
