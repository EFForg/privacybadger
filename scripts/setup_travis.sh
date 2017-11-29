#!/bin/bash
toplevel=$(git rev-parse --show-toplevel)

function setup_chrome {
    # Install the latest version of the chromedriver
    version=$(wget https://chromedriver.storage.googleapis.com/LATEST_RELEASE -q -O -)
    echo "Setting up chromedriver version $version ..."
    url="https://chromedriver.storage.googleapis.com/${version}/chromedriver_linux64.zip"
    wget -q -O /tmp/chromedriver.zip "$url"
    sudo unzip /tmp/chromedriver.zip chromedriver -d /usr/local/bin/
    sudo chmod a+x /usr/local/bin/chromedriver
}

function setup_firefox {
    # TODO needed until Firefox ESR moves on from Firefox 52
    # see https://github.com/mozilla/geckodriver/issues/1032#issuecomment-341337402
    if [[ $INFO == "firefox esr" ]]; then
      version="v0.17.0"
    else
      # Install the latest version of geckodriver
      version=$(curl -s https://api.github.com/repos/mozilla/geckodriver/releases/latest | grep tag_name | cut -d '"' -f 4)
    fi
    echo "Setting up geckodriver version $version ..."
    url="https://github.com/mozilla/geckodriver/releases/download/${version}/geckodriver-${version}-linux64.tar.gz"
    wget -q -O /tmp/geckodriver.tar.gz "$url"
    sudo tar -xvf /tmp/geckodriver.tar.gz -C /usr/local/bin/
    sudo chmod a+x /usr/local/bin/geckodriver
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

case $INFO in
  *chrome*)
    setup_chrome
    browser_setup
    ;;
  *firefox*) # Install the latest version of geckodriver
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
