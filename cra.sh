# Creates a simple CRA project, removing some of the unnecessary files
# (Eventually I will build a proper tool to do this, but in the meantime...)

# ensure there is a project name to build
if [[ $1 == '' ]]; then
  echo 'Usage: cra the_name_of_a_folder_you_want_created'
  exit
fi
project_name=$1

# this is only needed from a bash script, as it wouldn't find the nvm command
# otherwise - because nvm is not a command, but a shell function
. ~/.nvm/nvm.sh

# Typically I build all my projects inside ~/work, where I have a .nvmrc
nvm use

# make sure the global version of CRA is up to date
npm -g update create-react-app

npx create-react-app $project_name
cp ~/work/.nvmrc $project_name
cd $project_name

# get rid of unnecessary files, and move others out of the way
rm src/logo.svg src/App.css src/index.css
mkdir src/assets
mv src/registerServiceWorker.js src/assets/

# remove references to those unnecessary files in App.js
sed -i.bak \
-e '/logo/d' \
-e '/.css/d' \
src/App.js

# fix references to moved files in index.js
sed -i.bak \
-e 's_/App_/app/App_' \
-e 's_./index._./assets/reset._' \
-e 's_./regist_./assets/regist_' \
src/index.js

# get rid of the backups OS X forces on us
rm src/*.bak

# move app-files to own directory
mkdir src/app
mv src/App.* src/app

# add a simple reset from vladocar
export URL=https://raw.githubusercontent.com/vladocar/CSS-Micro-Reset/master/micro-css-reset.css
echo -e "/* $URL */\n" > src/assets/reset.css
curl $URL >> src/assets/reset.css

# eslint integration
echo '{ "extends": "react-app" }' > .eslintrc

# VSCode debugging
mkdir .vscode
cat << EOF > .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [{
    "name": "Chrome",
    "type": "chrome",
    "request": "launch",
    "url": "http://localhost:3000",
    "webRoot": "${workspaceRoot}/src",
    "sourceMapPathOverrides": {
      "webpack:///src/*": "${webRoot}/*"
    }
  }]
}
EOF

# add some useful .gitignore files for my environment
curl "https://www.gitignore.io/api/osx,visualstudiocode" >> .gitignore

# hopefully it all still works...
npm start