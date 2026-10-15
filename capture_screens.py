import os
import time
from selenium import webdriver
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def capture_all():
    os.makedirs('docs/screenshots', exist_ok=True)
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--window-size=1600,1020')
    options.add_argument('--disable-gpu')
    options.add_argument('--no-sandbox')
    
    driver = webdriver.Edge(options=options)
    driver.set_window_size(1600, 1020)
    wait = WebDriverWait(driver, 15)

    try:
        print("Navigating to login page...")
        driver.get("http://localhost:3000/login")
        time.sleep(2)
        driver.save_screenshot("docs/screenshots/01_login_portal.png")
        print("1. Saved 01_login_portal.png")

        # Click submit button to log in as default persona (Principal)
        submit_btn = wait.until(EC.element_to_be_clickable((By.XPATH, "//button[contains(., 'Enter Campus Ecosystem')]")))
        submit_btn.click()
        time.sleep(3)
        print("Logged in, current URL:", driver.current_url)

        # 2. Executive Dashboard Overview (Principal)
        driver.get("http://localhost:3000/dashboard")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/02_executive_dashboard.png")
        print("2. Saved 02_executive_dashboard.png")

        # 3. Analytics & AI Academic Early Warning Radar
        driver.get("http://localhost:3000/dashboard/analytics")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/03_analytics_ai_radar.png")
        print("3. Saved 03_analytics_ai_radar.png")

        # 4. Attendance & 75% Statutory Radar
        driver.get("http://localhost:3000/dashboard/attendance")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/04_attendance_radar.png")
        print("4. Saved 04_attendance_radar.png")

        # 5. Campus Safety, CCTV Registry & Edge AI Tracking
        driver.get("http://localhost:3000/dashboard/cameras")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/05_campus_safety_tracking.png")
        print("5. Saved 05_campus_safety_tracking.png")

        # 6. Fees, Invoices & Digital Payments
        driver.get("http://localhost:3000/dashboard/fees")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/06_finance_fees.png")
        print("6. Saved 06_finance_fees.png")

        # 7. Digital Library & Circulation
        driver.get("http://localhost:3000/dashboard/library")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/07_digital_library.png")
        print("7. Saved 07_digital_library.png")

        # 8. Print Shop Kiosk Queue
        driver.get("http://localhost:3000/dashboard/printshop")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/08_print_shop_kiosk.png")
        print("8. Saved 08_print_shop_kiosk.png")

        # Now let's capture the Student Academic Dashboard persona!
        # Clear localStorage and log in as student
        driver.execute_script("window.localStorage.clear();")
        driver.get("http://localhost:3000/login")
        time.sleep(2)
        
        # Click the Student persona card
        student_card = driver.find_element(By.XPATH, "//*[contains(text(), 'student.rahul@apex.edu')]")
        student_card.click()
        time.sleep(1)
        submit_btn = driver.find_element(By.XPATH, "//button[contains(., 'Enter Campus Ecosystem')]")
        submit_btn.click()
        time.sleep(3)
        driver.get("http://localhost:3000/dashboard")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/09_student_academic_hub.png")
        print("9. Saved 09_student_academic_hub.png")

        # 10. Faculty & Mentor Dashboard persona
        driver.execute_script("window.localStorage.clear();")
        driver.get("http://localhost:3000/login")
        time.sleep(2)
        faculty_card = driver.find_element(By.XPATH, "//*[contains(text(), 'faculty.priya@apex.edu')]")
        faculty_card.click()
        time.sleep(1)
        submit_btn = driver.find_element(By.XPATH, "//button[contains(., 'Enter Campus Ecosystem')]")
        submit_btn.click()
        time.sleep(3)
        driver.get("http://localhost:3000/dashboard")
        time.sleep(3)
        driver.save_screenshot("docs/screenshots/10_faculty_mentor_portal.png")
        print("10. Saved 10_faculty_mentor_portal.png")

        print("All screenshots successfully captured!")

    finally:
        driver.quit()

if __name__ == '__main__':
    capture_all()
