#!/bin/bash
toplevel=$(git rev-parse --show-toplevel)

function setup_chrome {
    # Install the latest version of the chromedriver
    version=$(wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE -q -O -)
    echo "Setting up chromedriver version $version ..."
    url="https://chromedriver.storage.googleapis.com/${version}/chromedriver_linux64.zip"
    wget -q -O /tmp/chromedriver.zip "$url"
    sudo unzip -o /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
    sudo chmod a+x /usr/local/bin/chromedriver

    # check that chromedriver is now present
    type chromedriver >/dev/null 2>&1 || {
      echo "Failed to install chromedriver!"
      exit 1
    }
}

function setup_firefox {
    # TODO needed until Firefox ESR moves on from Firefox 52
    # see https://github.com/mozilla/geckodriver/issues/1032#issuecomment-341337402
    if [[ $INFO == "firefox esr" ]]; then
      version="v0.17.0"
    else
      # Install the latest version of geckodriver
      version=$(curl -sI https://github.com/mozilla/geckodriver/releases/latest | grep "^Location: " | sed 's/.*\///' | tr -d '\r')

      # check that we got something
      if [ -z "$version" ]; then
        echo "Failed to determine the latest geckodriver version!"
        exit 1
      fi
    fi
    echo "Setting up geckodriver version $version ..."
    url="https://github.com/mozilla/geckodriver/releases/download/${version}/geckodriver-${version}-linux64.tar.gz"
    wget -q -O /tmp/geckodriver.tar.gz "$url"
    sudo tar -xvf /tmp/geckodriver.tar.gz -C /usr/local/bin/
    sudo chmod a+x /usr/local/bin/geckodriver

    # check that geckodriver is now present
    type geckodriver >/dev/null 2>&1 || {
      echo "Failed to install geckodriver!"
      exit 1
    }
}

function browser_setup {
  # install python stuff
  pip install -r "$toplevel"/tests/requirements.txt
}

function setup_lint {
  pushd "$toplevel"
    # "--production" to skip installing devDependencies modules
    npm install --production
  popd

}

# check that the desired browser is present as it might fail to install
# for example: https://travis-ci.org/EFForg/privacybadger/jobs/362381214
function check_browser {
  type "$BROWSER" >/dev/null 2>&1 || {
    echo "$BROWSER seems to be missing!"
    exit 1
  }

  # print the version
  echo "Found $("$BROWSER" --version)"
}

case $INFO in
  *chrome*)
    check_browser
    setup_chrome
    browser_setup
    ;;
  *firefox*) # Install the latest version of geckodriver
    check_browser
    setup_firefox
    browser_setup
    ;;
  *lint*)
    setup_lint
    ;;
  *)
    echo "bad INFO variable, got $INFO"
    exit 1
    ;;
esac
