## Installation
1) Open the desktop version of Pinegrow - this plugin **will not** work with Pinegrow Live
2) Select File -> Manage libraries & plugins...
3) Click on "Load plugin" at the bottom
4) Navigate to the plugin folder and select "GHForPG.js"
5) I recommend restarting Pinegrow, but this isn't neccessary.

## Usage
This plugin will add a new "GitHub" menu to Pinegrow. There are five selections when a project is not open and two additional items when one is open.

### Settings
The setting selection opens a modal to add in your user name, email, and personal token for GitHub. These will be stored in a localStorage variable in Pinegrow and should be retained between restarts. There is a "Retrieve Settings" button that will get the user name and email for a project, but not the authorization token. All further actions by the plugin require authorization.

## New Repo Controls
### Create New Repo
This will allow the creation of a new GitHub repo, either from scratch or from an existing project. If the project doesn't exist, a base folder will be created that should then be opened as a Pinegrow project.

### Clone Existing Repo
This will create a local copy of a repo from GitHub and link this local copy to the repo on GitHub

### Branch Existing Repo
This will create a local copy and a new branch of an existing GitHub repo.

### Fork Existing Repo
This will create a local copy and a duplicate of a repo on GitHub from a foreign account into the user's account.

## Existing Repo Controls
### Stage, Commit, and Push Changes
This allows you to select which files are committed to a repo. It flags changed and added files.
1) Select files and click "Stage files"
   
    -If you make a mistake you can select a file and click "Unstage files"

2) Enter the author email
3) Enter a commit message
4) Click on "Commit files"
5) Click on "Push files"
   
### Pull changes
This will retrieve any changes made to the GitHub repo that aren't present in the local repo.