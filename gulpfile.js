'use strict'

const fs = require('fs')
const { join } = require('path')
const gulp = require('gulp')
const Server = require('karma').Server
const concat = require('gulp-concat')
const uglify = require('gulp-uglify')
const header = require('gulp-header')
const plato = require('plato')
const { exec, spawn } = require('child_process')
const pkg = require('./package.json')

const coreFiles = 'src/ajax.js'
const testFiles = 'test/**/*.js'
const apiFiles = 'api/**/*.js'
const allFiles = [coreFiles, testFiles, apiFiles]

const banner = () => {
  return [
    '/**!',
    ' * <%= pkg.name.replace("@fdaciuk/", "") %> - v<%= pkg.version %>',
    ' * <%= pkg.description %>',
    ' * <%= pkg.homepage %>',
    '',
    ' * <%= new Date( Date.now() ) %>',
    ' * <%= pkg.license %> (c) <%= pkg.author %>',
    '*/',
    ''
  ].join('\n')
}

const run = (command) => new Promise((resolve, reject) => {
  const [program, ...params] = command.split(' ')
  const cmd = spawn(program, params, { stdio: 'inherit' })
  cmd.on('close', resolve)
  cmd.on('error', reject)
})

gulp.task('lint', () => run('yarn lint'))

gulp.task('uglify', () => {
  gulp.src(coreFiles)
    .pipe(concat('ajax.min.js'))
    .pipe(uglify())
    .pipe(header(banner(), { pkg: pkg }))
    .pipe(gulp.dest('./dist'))
})

gulp.task('test', (done) => {
  return new Server({
    configFile: join(__dirname, 'karma.conf.js'),
    singleRun: true
  }, () => done()).start()
})

gulp.task('watch', [ 'test', 'lint' ], () => {
  gulp.watch(allFiles, [ 'test', 'lint' ])
})

gulp.task('plato', done => {
  const files = [ coreFiles ]
  const outputDir = './plato'
  const options = { title: '#Ajax' }
  const callback = (report) => done()
  plato.inspect(files, outputDir, options, callback)
})

gulp.task('update-readme', (done) => {
  fs.readFile('README.md', 'utf8', (err, file) => {
    if (err) throw err
    const updateVersion = file.split('\n').reduce((acc, line) => {
      const versionLine = line.includes('//cdn.rawgit.com/fdaciuk/ajax')
      let newLine = line
      if (versionLine) {
        newLine = line.replace(/\/v([\d.]+)\//, `/v${pkg.version}/`)
      }
      return acc.concat(newLine)
    }, [])

    fs.writeFile('README.md', updateVersion.join('\n'), done)
  })
})

gulp.task('deploy', done => {
  const date = new Date(Date.now())
  const execCommand = (command, message) => {
    console.log(`- ${message}`)
    return new Promise((resolve, reject) => {
      exec(command.join(' && '), (err, stdout, stderr) => {
        if (err) return reject(err)
        return resolve(stdout)
      })
    })
  }

  const syncRepository = [
    'git pull origin dev --force'
  ]
  const createNewVersion = [
    'gulp update-readme',
    'gulp uglify',
    'git add .',
    'git commit -m "Minifying"',
    'git tag -f v' + pkg.version
  ]
  const generateReports = [
    'gulp plato',
    'rm -rf .tmp',
    'mkdir .tmp',
    'cd .tmp',
    'git clone git@github.com:reportz/ajax.git ./',
    'cp -R ../coverage ../plato ./',
    'git add -A',
    'git commit -m "Update reports at ' + date + ' "',
    'git push origin gh-pages',
    'cd ../',
    'rm -rf .tmp'
  ]
  const updateMainBranch = [
    'git checkout master',
    'git merge dev',
    'git push origin master --tags'
  ]
  const updateDevBranch = [
    'git checkout dev',
    'git push origin dev --tags'
  ]
  const npmPublish = [
    'npm run pub'
  ]

  execCommand(syncRepository, 'Sync repository...')
    .then(() => execCommand(createNewVersion, 'Create new Version...'))
    .then(() => execCommand(generateReports, 'Generate reports...'))
    .then(() => execCommand(updateMainBranch, 'Update master branch...'))
    .then(() => execCommand(updateDevBranch, 'Update dev branch...'))
    .then(() => execCommand(npmPublish, 'Publish on NPM...'))
    .then(() => {
      console.log('Done!')
      process.exit(0)
    })
    .catch((err) => {
      console.log(err)
      process.exit(1)
    })
})

gulp.task('default', [ 'watch' ])
