"""
Comprehensive API testing for Boss Pay Up.
Tests all major endpoints with proper error handling.
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8001/api"


class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.created_ids = {"departments": [], "reimbursements": [], "images": []}

    def log_test(self, name, success, message=""):
        """Log a test result."""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status}: {name}"
        if message:
            result += f" - {message}"
        print(f"  {result}")
        self.test_results.append((name, success, message))
        return success

    def cleanup(self):
        """Clean up created test data."""
        print("\nCleaning up test data...")

        # Delete test images
        for image_id in self.created_ids["images"]:
            try:
                self.session.delete(f"{BASE_URL}/images/{image_id}")
            except:
                pass

        # Delete test reimbursements
        for reimb_id in self.created_ids["reimbursements"]:
            try:
                self.session.delete(f"{BASE_URL}/reimbursements/{reimb_id}")
            except:
                pass

        # Delete test departments (except default ones)
        for dept_id in self.created_ids["departments"]:
            if not dept_id.startswith("d"):  # Skip default departments
                try:
                    self.session.delete(f"{BASE_URL}/departments/{dept_id}")
                except:
                    pass

    def test_departments(self):
        """Test department endpoints."""
        print("\n" + "=" * 60)
        print("TESTING DEPARTMENT ENDPOINTS")
        print("=" * 60)

        # Test 1: Get all departments
        try:
            response = self.session.get(f"{BASE_URL}/departments")
            success = response.status_code == 200
            data = response.json() if success else []
            self.log_test(
                "GET /departments",
                success,
                f"Status: {response.status_code}, Count: {len(data)}",
            )
        except Exception as e:
            self.log_test("GET /departments", False, f"Exception: {e}")

        # Test 2: Create a new department
        try:
            new_dept = {
                "name": f"Test Dept {datetime.now().strftime('%H%M%S')}",
                "description": "Test department created by API tester",
            }
            response = self.session.post(f"{BASE_URL}/departments", json=new_dept)
            success = response.status_code == 200
            if success:
                data = response.json()
                dept_id = data["id"]
                self.created_ids["departments"].append(dept_id)
                self.log_test(
                    "POST /departments", success, f"Created department ID: {dept_id}"
                )
            else:
                self.log_test(
                    "POST /departments",
                    False,
                    f"Status: {response.status_code}, Response: {response.text}",
                )
        except Exception as e:
            self.log_test("POST /departments", False, f"Exception: {e}")

        # Test 3: Get specific department
        if self.created_ids["departments"]:
            dept_id = self.created_ids["departments"][0]
            try:
                response = self.session.get(f"{BASE_URL}/departments/{dept_id}")
                success = response.status_code == 200
                self.log_test(
                    f"GET /departments/{{id}}",
                    success,
                    f"Status: {response.status_code}",
                )
            except Exception as e:
                self.log_test(f"GET /departments/{{id}}", False, f"Exception: {e}")

        # Test 4: Update department
        if self.created_ids["departments"]:
            dept_id = self.created_ids["departments"][0]
            try:
                updated_dept = {
                    "name": f"Updated Test Dept {datetime.now().strftime('%H%M%S')}",
                    "description": "Updated description",
                }
                response = self.session.put(
                    f"{BASE_URL}/departments/{dept_id}", json=updated_dept
                )
                success = response.status_code == 200
                self.log_test(
                    f"PUT /departments/{{id}}",
                    success,
                    f"Status: {response.status_code}",
                )
            except Exception as e:
                self.log_test(f"PUT /departments/{{id}}", False, f"Exception: {e}")

        # Test 5: Get non-existent department (should 404)
        try:
            response = self.session.get(f"{BASE_URL}/departments/nonexistent123")
            success = response.status_code == 404
            self.log_test(
                "GET non-existent department",
                success,
                f"Expected 404, got {response.status_code}",
            )
        except Exception as e:
            self.log_test("GET non-existent department", False, f"Exception: {e}")

    def test_reimbursements(self):
        """Test reimbursement endpoints."""
        print("\n" + "=" * 60)
        print("TESTING REIMBURSEMENT ENDPOINTS")
        print("=" * 60)

        # Test 1: Get all reimbursements
        try:
            response = self.session.get(f"{BASE_URL}/reimbursements")
            success = response.status_code == 200
            data = response.json() if success else []
            self.log_test(
                "GET /reimbursements",
                success,
                f"Status: {response.status_code}, Count: {len(data)}",
            )

            # Store first reimbursement ID for later tests
            if data:
                self.sample_reimb_id = data[0]["id"]
        except Exception as e:
            self.log_test("GET /reimbursements", False, f"Exception: {e}")

        # Test 2: Get reimbursements with search
        try:
            response = self.session.get(f"{BASE_URL}/reimbursements?search=打车")
            success = response.status_code == 200
            data = response.json() if success else []
            self.log_test(
                "GET /reimbursements?search=打车",
                success,
                f"Status: {response.status_code}, Results: {len(data)}",
            )
        except Exception as e:
            self.log_test("GET /reimbursements?search=打车", False, f"Exception: {e}")

        # Test 3: Get reimbursements by department
        try:
            response = self.session.get(f"{BASE_URL}/reimbursements?department_id=d1")
            success = response.status_code == 200
            data = response.json() if success else []
            self.log_test(
                "GET /reimbursements?department_id=d1",
                success,
                f"Status: {response.status_code}, Results: {len(data)}",
            )
        except Exception as e:
            self.log_test(
                "GET /reimbursements?department_id=d1", False, f"Exception: {e}"
            )

        # Test 4: Create a new reimbursement
        try:
            new_reimb = {
                "desc": f"API Test Expense {datetime.now().strftime('%H:%M:%S')}",
                "amount": 99.99,
                "category": "测试",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "status": "待审批",
                "department_id": "d1",
            }
            response = self.session.post(f"{BASE_URL}/reimbursements", json=new_reimb)
            success = response.status_code == 200
            if success:
                data = response.json()
                reimb_id = data["id"]
                self.created_ids["reimbursements"].append(reimb_id)
                self.log_test(
                    "POST /reimbursements",
                    success,
                    f"Created reimbursement ID: {reimb_id}",
                )
            else:
                self.log_test(
                    "POST /reimbursements",
                    False,
                    f"Status: {response.status_code}, Response: {response.text}",
                )
        except Exception as e:
            self.log_test("POST /reimbursements", False, f"Exception: {e}")

        # Test 5: Get specific reimbursement
        if hasattr(self, "sample_reimb_id"):
            try:
                response = self.session.get(
                    f"{BASE_URL}/reimbursements/{self.sample_reimb_id}"
                )
                success = response.status_code == 200
                self.log_test(
                    f"GET /reimbursements/{{id}}",
                    success,
                    f"Status: {response.status_code}",
                )
            except Exception as e:
                self.log_test(f"GET /reimbursements/{{id}}", False, f"Exception: {e}")

        # Test 6: Update reimbursement
        if self.created_ids["reimbursements"]:
            reimb_id = self.created_ids["reimbursements"][0]
            try:
                updated_reimb = {
                    "desc": f"Updated API Test Expense {datetime.now().strftime('%H:%M:%S')}",
                    "amount": 150.00,
                    "category": "交通",
                    "date": datetime.now().strftime("%Y-%m-%d"),
                    "status": "已报销",
                    "department_id": "d2",
                }
                response = self.session.put(
                    f"{BASE_URL}/reimbursements/{reimb_id}", json=updated_reimb
                )
                success = response.status_code == 200
                self.log_test(
                    f"PUT /reimbursements/{{id}}",
                    success,
                    f"Status: {response.status_code}",
                )
            except Exception as e:
                self.log_test(f"PUT /reimbursements/{{id}}", False, f"Exception: {e}")

        # Test 7: Get summary
        try:
            response = self.session.get(f"{BASE_URL}/summary")
            success = response.status_code == 200
            if success:
                data = response.json()
                self.log_test(
                    "GET /summary",
                    success,
                    f"Total: {data.get('totalCount', 0)}, Amount: {data.get('totalAmount', 0)}",
                )
            else:
                self.log_test("GET /summary", False, f"Status: {response.status_code}")
        except Exception as e:
            self.log_test("GET /summary", False, f"Exception: {e}")

        # Test 8: Get department stats
        try:
            response = self.session.get(f"{BASE_URL}/departments/d1/stats")
            success = response.status_code == 200
            if success:
                data = response.json()
                self.log_test(
                    "GET /departments/{id}/stats",
                    success,
                    f"Dept: {data.get('department_id', 'N/A')}, Count: {data.get('totalCount', 0)}",
                )
            else:
                self.log_test(
                    "GET /departments/{id}/stats",
                    False,
                    f"Status: {response.status_code}",
                )
        except Exception as e:
            self.log_test("GET /departments/{id}/stats", False, f"Exception: {e}")

    def test_images(self):
        """Test image endpoints (informational only - no actual file upload)."""
        print("\n" + "=" * 60)
        print("TESTING IMAGE ENDPOINTS (INFORMATIONAL)")
        print("=" * 60)

        # Test 1: Get images for a reimbursement
        if hasattr(self, "sample_reimb_id"):
            try:
                response = self.session.get(
                    f"{BASE_URL}/reimbursements/{self.sample_reimb_id}/images"
                )
                success = response.status_code == 200
                data = response.json() if success else []
                self.log_test(
                    f"GET /reimbursements/{{id}}/images",
                    success,
                    f"Status: {response.status_code}, Images: {len(data)}",
                )
            except Exception as e:
                self.log_test(
                    f"GET /reimbursements/{{id}}/images", False, f"Exception: {e}"
                )

        print("\nNote: File upload tests require actual file upload.")
        print("To test file upload manually:")
        print(
            f"  curl -X POST -F 'file=@/path/to/image.jpg' {BASE_URL}/reimbursements/{{id}}/images"
        )
        print(f"  curl -X DELETE {BASE_URL}/images/{{image_id}}")

    def run_all_tests(self):
        """Run all API tests."""
        print("=" * 60)
        print("API TEST SUITE")
        print("=" * 60)
        print(f"Base URL: {BASE_URL}")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            self.test_departments()
            self.test_reimbursements()
            self.test_images()

            # Summary
            print("\n" + "=" * 60)
            print("TEST SUMMARY")
            print("=" * 60)

            total = len(self.test_results)
            passed = sum(1 for _, success, _ in self.test_results if success)
            failed = total - passed

            print(f"Total tests: {total}")
            print(f"Passed: {passed}")
            print(f"Failed: {failed}")

            if failed > 0:
                print("\nFailed tests:")
                for name, success, message in self.test_results:
                    if not success:
                        print(f"  ❌ {name}: {message}")

            # Cleanup
            self.cleanup()

            return failed == 0

        except Exception as e:
            print(f"\n❌ Test suite crashed with error: {e}")
            import traceback

            traceback.print_exc()
            return False


def main():
    """Main entry point."""
    tester = APITester()

    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user.")
        tester.cleanup()
        return 130
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
