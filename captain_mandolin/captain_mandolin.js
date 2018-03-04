#!/usr/bin/env node

/**
 * Script to move a selection of movie files in rotation from one repository
 * folder to a detination folder. Say you have a repo with this structure:
 * Cartoons/
 *   Biene Maia/
 *     BM01.mp4
 *     BM02.mp4
 *   Sandmännchen/
 *     S01.mp4
 * Documentaries/
 *   01.mp4
 *   02.mp4
 * ...
 * and in your config file you have Cartoons/ and Documentaries/ as your folders
 * then the first time you run it you'll copy to dest:
 *   Cartoons/Biene Maia/BM01.mp4 Documentaries/01.mp4
 * then
 *   Cartoons/Biene Maia/BM02.mp4 Documentaries/02.mp4
 *   Cartoons/Sandmännchen/S01.mp4 Documentaries/01.mp4
 *   ...
 *
 * Usage:
 *    captain_mandolin
 * copies a new set of files (you need to delete old one manually)
 *
 *   captain_mandolin -a /pth/to/folder
 * adds a new folder to sources (no file wil be copied)
 *
 *   captian_mandolin -c /pth/to/config
 * deine a config file
 *
 *
 */

const glob = require('glob');
const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');
const program = require('commander');

const SETTINGS_PATH = './.config.js';
const SETTINGS_OLD_PATH = './.config.previous.js';
const GLOB_SETTINGS = Object.freeze({ nodir: true });

program
  .version('0.0.1')
  .option(
    `-c, --config [path]`,
    `path to a config file, default ${SETTINGS_PATH}`,
    SETTINGS_PATH
  )
  .option(`-a, --add <path>`, `add a directory`)
  .parse(process.argv);

// reads settings file if found, if not it wil create one from scratch later
let settings = { sources: [] };
if (fs.existsSync(program.config)) {
  settings = JSON.parse(fs.readFileSync(program.config, 'utf8'));
}

// Using promises because of inquirer, although it would be nicer with async
Promise.resolve(settings)
  .then(getRoot)
  .then(getDest)
  .then(writeSettings.bind(null, SETTINGS_OLD_PATH))
  .then(settings => {
    if (program.add) {
      return addDir(settings);
    } else {
      return updateSources(settings);
    }
  })
  .then(writeSettings.bind(null, program.config))
  .then(settings =>
    console.log(`Done - ${settings.sources.length} sources`)
  );

// =======================================================

// reads from config, or prompts user for it
function getRoot(mySettings) {
  if (mySettings.root) {
    return Promise.resolve(mySettings);
  } else {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'root',
          message: 'Root folder'
        }
      ])
      .then(answers => {
        mySettings.root = answers.root;
        return mySettings;
      });
  }
}

// reads from config, or prompts user for it
function getDest(mySettings) {
  if (mySettings.dest) {
    return Promise.resolve(mySettings);
  } else {
    return inquirer
      .prompt([
        {
          type: 'input',
          name: 'dest',
          message: 'Destination folder'
        }
      ])
      .then(answers => {
        mySettings.dest = answers.dest;
        return mySettings;
      });
  }
}

// adds a folder to settings
function addDir(settings) {
  if (
    program.add &&
    -1 ===
      settings.sources.findIndex(source => source.dir === program.add)
  ) {
    settings.sources.push({
      dir: program.add
    });
  }
  return settings;
}

// rotates vides, updates sources, and copies new videos
function updateSources(settings) {
  const { root, extension, dest } = settings;

  settings.sources = settings.sources.map(source => {
    const mapped = {
      dir: source.dir,
      src: source.src,
      dest: source.dest || dest
    };
    const pth = `${root}${source.dir}/**/*.${extension}`;
    const files = glob.sync(pth, GLOB_SETTINGS);
    if (files.length === 0) return mapped;

    let nextSrc;
    if (source.src) {
      let i = files.indexOf(source.src);
      if (i !== -1) {
        i = (i + 1) % files.length;
        nextSrc = files[i];
      }
    } else {
      nextSrc = files[0];
    }

    if (nextSrc) {
      mapped.src = nextSrc;
    }

    return mapped;
  });

  settings.sources.forEach(source => {
    console.log(
      'copying from',
      source.src,
      'to',
      path.join(source.dest, path.basename(source.src))
    );
    try {
      fs.copyFileSync(
        source.src,
        path.join(source.dest, path.basename(source.src))
      );
    } catch (e) {
      console.log(`ERROR ${e}`);
    }
  });

  return settings;
}

function writeSettings(pth, settings) {
  fs.writeFileSync(pth, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}
