//Wrapper function with one parameter
module.exports = function(grunt) {
  var filename = 'distribution/<%= pkg.name %>-<%= manifest.version %>',
    zipName = filename + '.zip', crxName = filename + '.crx';

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    manifest: grunt.file.readJSON('manifest.json'),
    compress: {
      main: {
        options: {
          archive: zipName
        },
        files: [
          {src: ['_locales/**']}, 
          {src: ['doc/**']}, 
          {src: ['icons/**']}, 
          {src: ['lib/**']}, 
          {src: ['skin/**']}, 
          {src: ['src/**']}, 
          {src: ['tests/**']},
          {src: ['manifest.json']}
        ]
      }
    },
    zip_to_crx: {
      options: {
        privateKey: "scripts/dummy-chromium.pem"
      },
      extension: {
        src: zipName, 
        dest: crxName
      }
    }
    
  });

  grunt.loadNpmTasks('grunt-contrib-compress');
  grunt.loadNpmTasks('grunt-zip-to-crx');

  // What to do by default. In this case, nothing.
  grunt.registerTask('default', ['compress', 'zip_to_crx']);
};
