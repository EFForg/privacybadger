#!/usr/bin/env bash

# stop on errors (nonzero exit codes), uninitialized vars
set -eu

toplevel=$(git rev-parse --show-toplevel)

install_edge_webdriver() {
  edge_version=$(microsoft-edge-beta --product-version | cut -d . -f 1-3)
  webdriver_version=$(curl -s "https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/" | grep -Eo "/${edge_version}\.[0-9]+/edgedriver_linux64.zip" | head -n1)

  if [ -z "$webdriver_version" ]; then
    echo "Failed to retrieve Edge WebDriver version!"
    exit 1
  fi

  wget "https://msedgedriver.azureedge.net${webdriver_version}"
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
