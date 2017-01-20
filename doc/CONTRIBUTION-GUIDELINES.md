# PRIVACY BADGER CONTRIBUTION GUIDELINES

### GIT ETTIQUITE

When contributing to via git

If You are an owner:

 - Checkout the main repository and make a local branch for your change

 - Make your edits locally and then commit them to the origin repo as branch

 - Create a pull request from your branch to master, and have someone else code
   review your change

 - Once your change has been merged, delete your branch

If you are not an owner (and thus can't make a branch):

 - Follow the same procedure but with a personal fork of the repository

 - Ensure that your fork is up to date before committing your changes

### GENERAL ETTIQUITE

When making a code change:

 - Make sure all your tests pass, and take time to write new tests for your
   additions
 
 - Write regressions tests if it is a bug you're fixing, or if the code you're
   editing doesn't already have tests covering it

 - Take time to ensure your code works as expected, effort skipped here merely
   pushes the burden onto whomever reviews your commit

 - Run [ESLint](http://eslint.org/) on your code and fix any linting errors before submitting.
   Additionally make sure commented lines and print statements are removed

 - If there are changes that effect the visible operations of Privacy Badger
   that should be tested as part of code review, write up a short description of:
   the issue your fixing, how to reproduce that issue, what the fix should look
   like

When reviewing a code change:

 - Ensure all the tests pass, and take time to sanity check the changes in browser
 
 - Make sure code is consistent with our style-guidelines and is lint-free
 
 - If there are bugs with the pull request it is not your responsibility to fix
   them. Explain them to the submitter and request that they update their pull
   request
