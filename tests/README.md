```shell
sudo apt update
sudo apt install libgtk-3-0t64 libasound2t64 libx11-xcb1 # libpci3 libglu1-mesa-dev xvfb

npm i puppeteer-core --save-dev
sudo npx puppeteer browsers install firefox

export PUPPETEER_PRODUCT=firefox

node tests/e2e.mjs
```