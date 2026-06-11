import requests

def test_health():
    res = requests.get("http://127.0.0.1:8000/api/health")
    print("Health:", res.status_code, res.json())

def test_auth_and_predict():
    # Register/Login
    session = requests.Session()
    # Let's try registering a dummy user
    email = "test_scanner_user@skinguru.com"
    password = "TestPassword123!"
    
    register_payload = {
        "email": email,
        "password": password,
        "full_name": "Test Scanner User",
        "role": "patient"
    }
    
    print("Registering...")
    res = session.post("http://127.0.0.1:8000/api/auth/register", json=register_payload)
    print("Register response:", res.status_code)
    
    if res.status_code != 201:
        print("Registration failed or user already exists, trying login...")
        login_payload = {
            "email": email,
            "password": password
        }
        res = session.post("http://127.0.0.1:8000/api/auth/login", json=login_payload)
        print("Login response:", res.status_code, res.json())
    else:
        print("Register Success:", res.json())
        
    auth_data = res.json()
    token = auth_data["access_token"]
    
    # Let's test uploading a dummy image
    # We will create a small 28x28 pixel valid JPEG image using PIL
    from PIL import Image
    import io
    img = Image.new('RGB', (28, 28), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    img_bytes = img_byte_arr.getvalue()
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    print("Predicting image...")
    files = {
        "file": ("test.jpg", img_bytes, "image/jpeg")
    }
    
    res = session.post("http://127.0.0.1:8000/api/predict?model=ensemble", headers=headers, files=files)
    print("Predict response code:", res.status_code)
    try:
        print("Predict response JSON:", res.json())
    except Exception as e:
        print("Predict response text:", res.text)

if __name__ == "__main__":
    test_health()
    test_auth_and_predict()
