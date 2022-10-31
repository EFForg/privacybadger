#!/usr/bin/env bash

toplevel=$(git rev-parse --show-toplevel)

install_edge_webdriver() {
  edge_version_major=$(microsoft-edge-beta --product-version | cut -d . -f 1)
  edgedriver_version_url="https://msedgedriver.azureedge.net/LATEST_RELEASE_${edge_version_major}_LINUX"
  edgedriver_version=$(curl -s "$edgedriver_version_url" | tr -d "\0\r\n" | cut -c 3-)
  if [ -z "$edgedriver_version" ]; then
    echo "Failed to retrieve Edge WebDriver version!"
    exit 1
  fi

  echo "Installing Edge WebDriver version $edgedriver_version ..."
  wget "https://msedgedriver.azureedge.net/${edgedriver_version}/edgedriver_linux64.zip"
  unzip edgedriver_linux64.zip
  sudo mv msedgedriver /usr/local/bin/
  sudo chmod a+x /usr/local/bin/msedgedriver

  # check that Edge WebDriver is now present
  type msedgedriver >/dev/null 2>&1 || {
    echo "Failed to install Edge WebDriver!"
    exit 1
  }
}

install_geckodriver() {
    # Install the latest version of geckodriver
    version=$(curl -sI https://github.com/mozilla/geckodriver/releases/latest | grep -i "^Location: " | sed 's/.*\///' | tr -d '\r')

    # check that we got something
    if [ -z "$version" ]; then
      echo "Failed to determine the latest geckodriver version!"
      exit 1
    fi

    # Geckodriver distribution is MacOS or Linux specific
    os="$(uname -s)"
    if [[ $os == "Darwin" ]]; then
      os_dist="macos.tar.gz"
    else
      os_dist="linux64.tar.gz"
    fi

    echo "Setting up geckodriver version $version ..."
    url="https://github.com/mozilla/geckodriver/releases/download/${version}/geckodriver-${version}-${os_dist}"
    wget -q -O /tmp/geckodriver.tar.gz "$url"
    sudo tar -xvf /tmp/geckodriver.tar.gz -C /usr/local/bin/
    sudo chmod a+x /usr/local/bin/geckodriver

    # check that geckodriver is now present
    type geckodriver >/dev/null 2>&1 || {
      echo "Failed to install geckodriver!"
      exit 1
    }
}

install_python_deps() {
  pip install -r "$toplevel"/tests/requirements.txt
}

install_node_deps() {
  # "--production" to skip installing devDependencies modules
  npm ci --production || exit 1
}

# check that the desired browser is present as it might fail to install
# for example: https://travis-ci.org/EFForg/privacybadger/jobs/362381214
check_browser() {
  type "$BROWSER" >/dev/null 2>&1 || {
    echo "$BROWSER seems to be missing!"
    exit 1
  }

  # print the version
  echo "Found $("$BROWSER" --version)"
}

case $INFO in
  *Chrome*)
    check_browser
    "$toplevel"/scripts/chromedriver.sh "$BROWSER"
    install_python_deps
    ;;
  *Firefox*)
    check_browser
    install_geckodriver
    install_python_deps
    ;;
  *Edge*)
    check_browser
    install_edge_webdriver
    install_python_deps
    ;;
  *lint*)
    install_node_deps
    ;;
  *)
    echo "bad INFO variable, got $INFO"
    exit 1
    ;;
esac
