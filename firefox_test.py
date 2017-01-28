from selenium.webdriver import DesiredCapabilities
from selenium import webdriver

ffcaps = DesiredCapabilities.FIREFOX
driver = webdriver.Remote('http://127.0.0.1:4444', ffcaps)
print(driver)
