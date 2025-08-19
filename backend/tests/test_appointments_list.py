# Task: Integration test for GET /appointments
import requests

API_ENDPOINT = "https://nc47d9v6d1.execute-api.us-west-2.amazonaws.com/appointments"  # Live API Gateway endpoint


def test_get_appointments():
    response = requests.get(API_ENDPOINT)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()
    assert "appointments" in data, "Response should contain 'appointments' key"
    assert isinstance(data["appointments"], list), "'appointments' should be a list"
    print("Appointments:", data["appointments"])


if __name__ == "__main__":
    test_get_appointments()
