const path         = require('path')
    , childProcess = require('child_process')
    , copy         = require('../../lib/copy')
    , gyp          = require('../../lib/gyp')
    , solutions    = require('../../lib/solutions')
    , check        = require('../../lib/check')
    , compile      = require('../../lib/compile')
    , packagejson  = require('../../lib/packagejson')


const solutionFiles   = [ 'myaddon.cc', 'index.js' ]
      // a place to make a full copy to run a test compile
    , copyTempDir     = path.join(process.cwd(), '~test-addon.' + Math.floor(Math.random() * 10000))
      // a place to make a full copy to replace myaddon.cc with a mock to do a mocked run to test JS
    , copyFauxTempDir = path.join(process.cwd(), '~test-addon-faux.' + Math.floor(Math.random() * 10000))
      // what we should get on stdout for this to pass
    , expected        = 'this is a test, I repeat, this is a test'


var exercise = require('workshopper-exercise')()

// add solutions file listing from solutions/ directory
exercise = solutions(exercise, solutionFiles)

// the steps towards verification
exercise.addProcessor(check.checkSubmissionDir)
exercise.addProcessor(copy.copyTemp([ copyTempDir, copyFauxTempDir ]))
exercise.addProcessor(copyFauxAddon)
exercise.addProcessor(packagejson.checkPackageJson)
exercise.addProcessor(gyp.checkBinding)
exercise.addProcessor(compile.checkCompile(copyTempDir))
exercise.addProcessor(checkJs)
exercise.addProcessor(checkExec)

// always clean up the temp directories
exercise.addCleanup(copy.cleanup([ copyTempDir, copyFauxTempDir ]))


function copyFauxAddon (mode, callback) {
  copy(path.join(__dirname, 'solution', 'myaddon.cc'), copyFauxTempDir, function (err) {
    if (err)
      return callback(err)

    callback(null, true)
  })
}


function execWith (dir, str, callback) {
  childProcess.exec(
      process.execPath + ' "' + dir + '" "' + str + '"'
    , function (err, stdout, stderr) {
        if (err) {
          process.stderr.write(stderr)
          process.stdout.write(stdout)
          return callback(err)
        }

        var pass = stdout.toString() == str.length + '\n'

        if (!pass) {
          process.stderr.write(stderr)
          process.stdout.write(stdout)
        }

        callback(null, pass)
      }
  )
}


// run `node-gyp rebuild` on a mocked version of the addon that prints what we want
// so we can test that their JS is doing what it is supposed to be doing and there
// is no cheating! (e.g. console.log(...))
function checkJs (mode, callback) {
  var exercise = this

  if (!exercise.passed)
    return callback(null, true) // shortcut if we've already had a failure

  gyp.rebuild(copyFauxTempDir, function (err) {
    if (err) {
      exercise.emit('fail', 'Compile mock C++ to test JavaScript: ' + err.message)
      return callback(null, false)
    }

    execWith(copyFauxTempDir, 'FAUX', function (err, pass) {
      if (err)
        return callback(err)
      if (!pass) {
        exercise.emit('fail', 'JavaScript code loads addon, invokes `length(str)` method and prints the return value')
        return callback(null, false)
      }

      execWith(copyFauxTempDir, 'FAUX FAUX FAUX FAUX', function (err, pass) {
        if (err)
          return callback(err)

        exercise.emit(pass ? 'pass' : 'fail'
            , 'JavaScript code loads addon, invokes `length(str)` method and prints the return value')
        callback(null, pass)
      })
    })
  })
}


// run a full execution of their code & addon, uses a `require()` in a child process
// and check the stdout for expected
function checkExec (mode, callback) {
  if (!exercise.passed)
    return callback(null, true) // shortcut if we've already had a failure

  execWith(copyTempDir, 'testing', function (err, pass) {
    if (err)
      return callback(err)
    if (!pass) {
      exercise.emit('fail', 'JavaScript code loads addon, invokes `length(str)` method and prints the return value')
      return callback(null, false)
    }

    execWith(copyTempDir, 'this is a longer test string, with spaces in it', function (err, pass) {
      if (err)
        return callback(err)

      exercise.emit(pass ? 'pass' : 'fail', 'Add-on receives string, calculates length and returns value')
      callback(null, pass)
    })
  })
}


module.exports = exercise