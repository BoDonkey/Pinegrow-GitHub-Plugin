$(function () {
    $('body').one('pinegrow-ready', function (e, pinegrow) {

        //Add a framework id, it should be unique to this framework and version. Best practice is to define the prefix as a variable that can be used throughout the framework.
        let framework_id = 'shd_github_for_pinegrow';

        //Instantiate a new framework
        var framework = new PgFramework(framework_id, 'GitHub-for-Pinegrow');

        // Define a framework type - if you plan on having multiple versions, this should be the same for each version. 
        framework.type = 'GitHub-for-Pinegrow';

        //Prevent the activation of multiple versions of the framework - if this should be allowed, change to false
        framework.allow_single_type = true;

        //Optional, add a badge to the framework list notify user of new or updated status
        //framework.info_badge = 'v1.0.0';

        //Add a description of the plugin
        framework.description = 'Adds GitHub functionality to Pinegrow';

        //Add a framework  author to be displayed with the framework templates
        framework.author = 'Robert "Bo" Means';

        //Add a website "https://pinegrow.com" or mailto "mailto:info@pinegrow.com" link for redirect on author name click
        framework.author_link = 'https://robertmeans.net';

        // Tell Pinegrow about the framework
        pinegrow.addFramework(framework);

        //uncomment the line below for debugging - opens devtools on Pinegrow Launch
        //require('nw.gui').Window.get().showDevTools();

        //Load in the Octokit module and plugins
        const frameBase = framework.getBaseUrl();
        const {
            Octokit
        } = require(crsaMakeFileFromUrl(frameBase + '/node_modules/@octokit/rest/dist-node/index.js'));

        //Load in Git functions
        const Git = require(crsaMakeFileFromUrl(frameBase + '/node_modules/isomorphic-git/index.cjs'));
        const http = require(crsaMakeFileFromUrl(frameBase + '/node_modules/isomorphic-git/http/node/index.cjs'));
        const glob = require(crsaMakeFileFromUrl(frameBase + '/node_modules/fast-glob/out/index.js'));

        //add in better folder selector
        const openFolderExplorer = require(crsaMakeFileFromUrl(frameBase + '/node_modules/nw-programmatic-folder-select/index.js'));

        //load in file management packages
        const Path = require('path');
        const fse = require('fs-extra');

        //Function to poulate settings with existing values, clear settings, save new settings.
        let ghManipulateSettingsFields = () => {
            //First, let's get all of the form fields and buttons
            let userNameField = ghById('gh-user-name');
            let emailField = ghById('gh-user-email');
            let accountTokenField = ghById('gh-token');
            let retrieveSettingsButton = ghById('gh-retrieve-settings');
            let clearSettingsButton = ghById('gh-clear-settings');
            let saveSettingsButton = ghById('gh-save-settings');
            let cancelSettingsButton = ghById('gh-cancel-settings');
            let userErrorMessage = ghById('gh-username-error');
            let emailErrorMessage = ghById('gh-email-error');
            let tokenErrorMessage = ghById('gh-token-error');
            let credentialsErrorMessage = ghById('gh-git-config-missing');
            let projectNotOpenError = ghById('gh-settings-project-error');
            let credentialsNotificationMessage = ghById('gh-settings-retrieved-notification');
            let credentialsMessage = ghById('gh-correct-credentials');
            let configNotification = ghById('gh-settings-config-notification');
            let showToken = ghById('gh-show-token');
            //check if the user has already stored any credentials in local storage, if so add them to the form
            if (localStorage.getItem('gh-settings-user-name')) {
                userNameField.value = localStorage.getItem('gh-settings-user-name');
                emailField.value = localStorage.getItem('gh-settings-email');
                accountTokenField.value = localStorage.getItem('gh-settings-token');
            }

            //Allow toggle of the token field between plain text and encoded
            showToken.addEventListener('click', () => {
                accountTokenField.type = showToken.checked ? "text" : "password";
            });

            //allow user to retrieve settings from gitconfig file
            retrieveSettingsButton.addEventListener('click', async () => {
                //Throw error if project isn't open
                if (!pinegrow.getCurrentProject()) {
                    projectNotOpenError.style.visibility = 'visible';
                    return;
                }
                let projectDirectory = ghProjectDirectory();
                //Get gitconfig file
                let ghCredentials = await ghFetchGitConfig(projectDirectory);
                //Throw error if file doesn't exist
                if (ghCredentials === false || ghCredentials === undefined) {
                    credentialsErrorMessage.style.visibility = 'visible';
                    return;
                }
                if (ghCredentials.userName === undefined || ghCredentials.userToken === undefined) {
                    credentialsErrorMessage.style.visibility = 'visible';
                    localStorage.setItem('gh-config-file-error', true);
                    return;
                }
                //Set form values to retrieved credentials
                credentialsNotificationMessage.style.visibility = 'visible';
                userNameField.value = ghCredentials.userName;
                accountTokenField.value = ghCredentials.userToken;
            });

            clearSettingsButton.addEventListener('click', () => {
                localStorage.removeItem('gh-settings-user-name');
                localStorage.removeItem('gh-settings-email');
                localStorage.removeItem('gh-settings-token');
                localStorage.removeItem('gh-config-file-error');
                userNameField.value = '';
                emailField.value = '';
                accountTokenField.value = '';
                accountTokenField.type = "password";
                showToken.checked = false;
                saveSettingsButton.className = 'btn btn-primary';
                userErrorMessage.style.visibility = 'hidden';
                emailErrorMessage.style.visibility = 'hidden';
                tokenErrorMessage.style.visibility = 'hidden';
                credentialsErrorMessage.style.visibility = 'hidden';
                projectNotOpenError.style.visibility = 'hidden';
                credentialsNotificationMessage.style.visibility = 'hidden';
                credentialsMessage.style.visibility = 'hidden';
                if (pinegrow.getCurrentProject()) {
                    let projectDirectory = ghProjectDirectory();
                    ghDeleteGitConfig(projectDirectory);
                }
            });

            saveSettingsButton.addEventListener('click', async () => {
                localStorage.setItem('gh-settings-user-name', userNameField.value);
                localStorage.setItem('gh-settings-email', emailField.value);
                localStorage.setItem('gh-settings-token', accountTokenField.value);
                if (emailField.value === '' || emailField.value === null) {
                    emailErrorMessage.style.visibility = 'visible';
                    return;
                }
                let errorCheck = await ghVerifyGitHubAccount();
                if (true === errorCheck) {
                    saveSettingsButton.className = 'btn btn-success';
                    userErrorMessage.style.visibility = 'hidden';
                    emailErrorMessage.style.visibility = 'hidden';
                    tokenErrorMessage.style.visibility = 'hidden';
                    credentialsErrorMessage.style.visibility = 'hidden';
                    projectNotOpenError.style.visibility = 'hidden';
                    credentialsNotificationMessage.style.visibility = 'hidden';
                    credentialsMessage.style.visibility = 'visible';
                    accountTokenField.type = "password";
                    if (pinegrow.getCurrentProject()) {
                        let projectDirectory = ghProjectDirectory();
                        if (localStorage.getItem('gh-config-file-error')) {
                            configNotification.style.visibility = 'visible';
                            localStorage.removeItem('gh-config-file-error');
                            ghWriteGitConfig(projectDirectory);
                        }
                    }
                } else if (-1 === errorCheck) {
                    userErrorMessage.style.visibility = 'visible';
                    localStorage.removeItem('gh-settings-user-name');
                    credentialsMessage.style.visibility = 'hidden';
                    emailErrorMessage.style.visibility = 'hidden';
                    tokenErrorMessage.style.visibility = 'hidden';
                    credentialsNotificationMessage.style.visibility = 'hidden';
                } else {
                    tokenErrorMessage.style.visibility = 'visible';
                    localStorage.removeItem('gh-settings-token');
                    credentialsMessage.style.visibility = 'hidden';
                    userErrorMessage.style.visibility = 'hidden';
                    emailErrorMessage.style.visibility = 'hidden';
                    credentialsNotificationMessage.style.visibility = 'hidden';
                }
            });

            cancelSettingsButton.addEventListener('click', () => {
                saveSettingsButton.className = 'btn btn-primary';
                userErrorMessage.style.visibility = 'hidden';
                tokenErrorMessage.style.visibility = 'hidden';
                credentialsMessage.style.visibility = 'hidden';
                projectNotOpenError.style.visibility = 'hidden';
                credentialsNotificationMessage.style.visibility = 'hidden'
                accountTokenField.type = "password";
                showToken.checked = false;
            })
        };

        //Function to gather new repo information.
        let ghManipulateCreateFields = async () => {
            let createModal = ghById('gh-create-modal');
            let closeButton = ghById('gh-create-close-button');
            let repoNameField = ghById('gh-new-repo-name');
            let useExistingControl = ghById('gh-use-existing-folder');
            let repoDescription = ghById('gh-repo-description');
            let repoCommitMessage = ghById('gh-create-commit-message');
            let repoCommitMessageGroup = ghById('gh-create-commit-message-group');
            let repoLicense = ghById('gh-repo-license');
            let repoPrivate = ghById('gh-repo-private');
            let repoInitialize = ghById('gh-auto-init');
            let repoInitializeGroup = ghById('gh-auto-initialize-group');
            let repoNameError = ghById('gh-repo-name-error');
            let newFolderGroup = ghById('gh-create-new-folder-group');
            let folderButton = ghById('gh-get-new-save-folder');
            let folderPath = ghById('gh-new-save-location');
            let folderNameGroup = ghById('gh-new-folder-name-group');
            let folderName = ghById('gh-new-folder-name');
            let useExisting = false;
            let correctCredentials = ghById('gh-create-correct-credentials');
            let incorrectCredentials = ghById('gh-create-incorrect-credentials');
            let createMessage = ghById('gh-create-message-box');
            let createNewRepo = ghById('gh-create-repo-button');
            let createResetButton = ghById('gh-create-reset');
            let createPathError = ghById('gh-create-path-error');
            let createLicenseError = ghById('gh-license-error');
            let newFolderNameError = ghById('gh-create-folder-name-error');

            createMessage.innerHTML = '<p>No message at this time</p>';

            useExistingControl.addEventListener('click', () => {
                if (pinegrow.getCurrentProject()) {
                    if (useExistingControl.checked) {
                        newFolderGroup.style.display = 'none';
                        folderNameGroup.style.display = 'none';
                        repoCommitMessageGroup.style.display = 'block';
                        repoInitializeGroup.style.display = 'none';
                        useExisting = true;
                        let currentProject = pinegrow.getCurrentProject();
                        let sanitizedName = ghSanitizeRepoName(currentProject.name)
                        repoNameField.value = sanitizedName;
                    } else {
                        newFolderGroup.style.display = 'block';
                        folderNameGroup.style.display = 'block';
                        repoCommitMessageGroup.style.display = 'none';
                        repoInitializeGroup.style.display = 'block';
                        useExisting = false;
                        repoNameField.value = '';
                    }
                } else {
                    createMessage.innerHTML = '<p>You must have a project open to use this option.</p>';
                    useExistingControl.checked = false;
                }
            });

            repoNameField.addEventListener('input', () => {
                if (!useExistingControl.checked) {
                    folderName.value = repoNameField.value;
                }
            });

            folderButton.addEventListener('click', () => {
                openFolderExplorer(window, (selection) => {
                    folderPath.innerHTML = selection;
                });
            });

            createResetButton.addEventListener('click', () => {
                folderPath.innerHTML = '';
                createModal.querySelectorAll('.gh-error').forEach(el => {
                    el.style.display = 'none';
                });
                createModal.querySelector('.gh-logged-in').style.display = 'none';
                createMessage.innerHTML = '<p>No message at this time</p>';
                createNewRepo.disabled = false;
            })

            createNewRepo.addEventListener('click', async () => {
                let errorCheck = await ghVerifyGitHubAccount();
                if (!errorCheck) {
                    createMessage.innerHTML = '<p>Please check your credentials.</p>';
                    incorrectCredentials.style.display = "block";
                    return;
                } else {
                    correctCredentials.style.display = "block";
                }
                if (repoNameField.value === '' || repoNameField.value === undefined) {
                    createMessage.innerHTML = '<p>Please add a repo name.</p>';
                    repoNameError.style.display = 'block';
                    return;
                }
                if (repoLicense.value === '') {
                    createMessage.innerHTML = '<p>Please select a license.</p>';
                    createLicenseError.style.display = 'block';
                    return;
                }
                if (folderPath.innerHTML === '' && !useExisting) {
                    createMessage.innerHTML = '<p>Please add a path to save your local repo.</p>';
                    createPathError.style.display = 'block';
                    return;
                }
                if ((folderName.value === '' || folderName.value === undefined) && !useExisting) {
                    createMessage.innerHTML = '<p>Please add a name for your local repo folder.</p>';
                    newFolderNameError.style.display = 'block';
                    return;
                }
                createMessage.innerHTML = "";
                let repoArgs = {
                    "name": repoNameField.value
                };
                repoArgs['description'] = repoDescription.value;
                repoArgs['license_template'] = repoLicense.value;

                if (repoPrivate.checked) {
                    repoArgs['private'] = true;
                }

                if (repoInitialize.checked) {
                    repoArgs['auto_init'] = true;
                }

                let repoCreated = await ghCreateRepo(repoArgs);
                ghStatusUpdate(repoCreated.status, createMessage, 'New Repo created.');

                if (!useExisting && repoCreated.status == "201") {
                    let owner = localStorage.getItem('gh-settings-user-name');
                    let newFolder = folderName.value;
                    let dir = Path.join(folderPath.innerHTML, newFolder);
                    let repo = "https://github.com/" + owner + "/" + repoNameField.value;
                    const onAuth = () => ({
                        username: localStorage.getItem('gh-settings-user-name'),
                        password: localStorage.getItem('gh-settings-token')
                    });
                    await ghClone(onAuth, repo, dir, createMessage, '');
                    let content = '_pgbackup';
                    let ignoreFile = Path.join(dir, '.gitignore');
                    try {
                        fse.writeFileSync(ignoreFile, content);
                    } catch (err) {
                        console.error(err);
                    }
                    let projectData = {
                        repo: repoNameField.value,
                        owner: owner,
                        branch: 'main'
                    };
                    ghCreateJsonFile(projectData, dir, 'githubinfo.json');
                    ghWriteGitConfig(dir);
                } else if (useExisting && repoCreated.status == "201") {
                    let owner = localStorage.getItem('gh-settings-user-name');

                    let projectDirectory = ghProjectDirectory();
                    let initializeProject = await Git.init({
                        fs: fse,
                        dir: projectDirectory,
                        defaultBranch: 'main'
                    });
                    let projectData = {
                        repo: repoNameField.value,
                        owner: owner,
                        branch: 'main'
                    };
                    let commitMessage = (repoCommitMessage.value) ? repoCommitMessage.value : undefined;
                    ghCreateJsonFile(projectData, projectDirectory, 'githubinfo.json');
                    let remoteUrl = 'https://github.com/' + owner + '/' + repoNameField.value;
                    let newAccountConfigValues = `[remote "origin"]
        fetch = +refs/heads/*:refs/remotes/origin/*
        url = ${remoteUrl}
[branch "main"]
        merge = refs/heads/main
        remote = origin`
                    let newValues = await ghWriteConfig(newAccountConfigValues, projectDirectory);
                    let baseValues = await ghWriteGitConfig(projectDirectory);
                    let uploadStatus = await ghUploadToRepoNew(projectDirectory, projectData, 'main', commitMessage);
                    ghStatusUpdate(uploadStatus, createMessage, 'Files uploaded');
                }
                createNewRepo.disabled = true;
            });

            closeButton.addEventListener('click', () => {
                createResetButton.click();
            })
        };

        //Function to gather existing repo information.
        let ghManipulateCloneFields = async () => {
            let repoOwner = ghById('gh-existing-repo-owner');
            let repoName = ghById('gh-existing-repo-name');
            let branchName = ghById('gh-clone-branch-name');
            let folderButton = ghById('gh-get-save-folder');
            let saveLocation = ghById('gh-save-location');
            let folderName = ghById('gh-clone-folder-name');
            let folderVerification = ghById('gh-clone-verification');
            let folderOkayButton = ghById('gh-clone-folder-okay');
            let folderCancelButton = ghById('gh-clone-folder-cancel');
            let clearButton = ghById('gh-clone-clear');
            let cloneButton = ghById('gh-get-existing-repo-button');
            let loginError = ghById('gh-clone-log-error');
            let logCheck = await ghVerifyGitHubAccount();
            if (logCheck !== true) {
                loginError.style.visibility = 'visible';
            } else {
                loginError.style.visibility = 'hidden';
            }
            let cloneMessage = ghById('gh-clone-message-box');
            cloneMessage.innerHTML = '<p>No message at this time</p>';
            folderButton.addEventListener('click', () => {
                openFolderExplorer(window, (selection) => {
                    saveLocation.innerHTML = selection;
                });
            });

            //Redo error checking?
            cloneButton.addEventListener('click', async () => {
                if (logCheck === true && folderName.value && saveLocation.innerHTML != '' && repoOwner.value && repoName.value) {
                    let cloneBranch = (branchName.value) ? branchName.value : '';
                    cloneMessage.innerHTML = "";
                    let newFolder = folderName.value;
                    let dir = Path.join(saveLocation.innerHTML, newFolder);
                    let dirCheck = fse.existsSync(dir);
                    if (dirCheck) {
                        folderVerification.classList.add('visible');
                        cloneMessage.innerHTML = "<p>Please verify existing folder overwrite.</p>";
                    } else {
                        let url = "https://github.com/" + repoOwner.value + "/" + repoName.value + '.git';
                        const onAuth = () => ({
                            username: localStorage.getItem('gh-settings-user-name'),
                            password: localStorage.getItem('gh-settings-token')
                        });
                        let cloneRepo = await ghClone(onAuth, url, dir, cloneMessage, cloneBranch);
                        if (cloneRepo) {
                            let successMessage = document.createElement('p');
                            successMessage.innerHTML = 'Repo successfully cloned.';
                            cloneMessage.appendChild(successMessage);
                            let projectData = {
                                repo: repoName.value,
                                owner: owner,
                                branch: 'main'
                            };
                            ghCreateJsonFile(projectData, dir, 'githubinfo.json');
                            ghWriteGitConfig(dir);
                            let content = '_pgbackup';
                            let ignoreFile = Path.join(dir, '.gitignore');
                            try {
                                const gitIgnore = fse.writeFileSync(ignoreFile, content);
                            } catch (err) {
                                console.error(err);
                            }
                        }
                    }
                } else {
                    cloneMessage.innerHTML = '<p style="color: red;">Check that your credentials are valid and you have filled out all of the fields.</p>';
                }
            });

            folderOkayButton.addEventListener('click', async () => {
                cloneMessage.innerHTML = '';
                let newFolder = folderName.value
                let dir = Path.join(saveLocation.innerHTML, newFolder);
                let cloneBranch = (branchName.value) ? branchName.value : '';
                let url = "https://github.com/" + repoOwner.value + "/" + repoName.value + '.git';
                const onAuth = () => ({
                    username: localStorage.getItem('gh-settings-user-name'),
                    password: localStorage.getItem('gh-settings-token')
                });
                await ghClone(onAuth, url, dir, cloneMessage, cloneBranch);
                if (cloneRepo) {
                    let successMessage = document.createElement('p');
                    successMessage.innerHTML = 'Repo successfully cloned.';
                    cloneMessage.appendChild(successMessage);
                    let projectData = {
                        repo: repoName.value,
                        owner: owner,
                        branch: 'main'
                    };
                    ghCreateJsonFile(projectData, dir, 'githubinfo.json');
                    ghWriteGitConfig(dir);
                    let ignoreFile = Path.join(dir, '.gitignore');
                    try {
                        const gitIgnore = fse.writeFileSync(ignoreFile, content);
                    } catch (err) {
                        console.error(err);
                    }
                }
            });

            folderCancelButton.addEventListener('click', () => {
                folderVerification.classList.remove('visible');
                cloneMessage.innerHTML = "";
            });

            clearButton.addEventListener('click', () => {
                repoOwner.value = '';
                repoName.value = '';
                saveLocation.innerHTML = '';
                folderName.value = '';
                cloneMessage.innerHTML = '';
                if (folderVerification.classList.contains('visible')) folderVerification.classList.remove('visible')
            });
        };

        //Function to gather branch info
        let ghManipulateBranchFields = async () => {
            let branchRepoOwner = ghById('gh-branch-repo-owner');
            let branchRepoName = ghById('gh-branch-repo-name');
            let branchBranchName = ghById('gh-branch-branch-name');
            let branchNewName = ghById('gh-branch-new-name');
            let branchFolderButton = ghById('gh-branch-get-save-folder');
            let branchFolderPath = ghById('gh-branch-save-location');
            let branchFolderName = ghById('gh-branch-folder-name');
            let branchVerification = ghById('gh-branch-verification');
            let branchOkay = ghById('gh-branch-folder-okay');
            let branchCancel = ghById('gh-branch-folder-cancel');
            let branchMessage = ghById('gh-branch-message-box');
            let branchSubmit = ghById('gh-branch-submit');
            let branchReset = ghById('gh-branch-reset-button');
            let branchClose = ghById('gh-branch-close');
            let correctCredentials = ghById('gh-branch-correct-credentials');
            let incorrectCredentials = ghById('gh-branch-incorrect-credentials');

            branchMessage.innerHTML = '<p>No message at this time.</p>';

            let errorCheck = await ghVerifyGitHubAccount();
            if (errorCheck) {
                correctCredentials.style.display = 'block';
                incorrectCredentials.style.display = 'none';
            } else {
                correctCredentials.style.display = 'none';
                incorrectCredentials.style.display = 'block';
            }

            let octokit = await ghCreateOctokitInstance();

            branchNewName.addEventListener('input', () => branchFolderName.value = branchNewName.value);

            branchFolderButton.addEventListener('click', () => {
                openFolderExplorer(window, (selection) => {
                    branchFolderPath.innerHTML = selection;
                });
            });

            branchReset.addEventListener('click', () => {
                branchFolderPath.innerHTML = '';
                branchMessage.innerHTML = '';
                if (branchVerification.classList.contains('visible')) branchVerification.classList.remove('visible');
            });

            branchClose.addEventListener('click', () => branchReset.click());

            branchSubmit.addEventListener('click', async () => {
                if (errorCheck && branchRepoOwner.value && branchRepoName.value && branchNewName.value && (branchFolderPath.innerHTML != '' || branchFolderPath.innerHTML != undefined) && branchFolderName.value) {
                    let branchBranch = (branchBranchName.value) ? branchBranchName.value : '';
                    branchMessage.innerHTML = '';
                    let newFolder = branchFolderName.value;
                    let dir = Path.join(branchFolderPath.innerHTML, newFolder);
                    let dirCheck = fse.existsSync(dir);
                    if (dirCheck) {
                        branchVerification.classList.add('visible');
                        branchMessage.innerHTML('<p>Please verify existing folder overwrite.</p>');
                    } else {
                        let cloneAndBranch = await ghCloneAndBranch(dir, branchMessage, branchBranch);
                    }
                } else {
                    cloneMessage.innerHTML = '<p style="color: red;">Check that your credentials are valid and you have filled out all of the fields.</p>';
                }
            });

            branchOkay.addEventListener('click', async () => {
                let branchBranch = (branchBranchName.value) ? branchBranchName.value : '';
                branchMessage.innerHTML = '';
                let newFolder = branchFolderName.value;
                let dir = Path.join(branchFolderPath.innerHTML, newFolder);
                let cloneAndBranch = await ghCloneAndBranch(dir, branchMessage, branchBranch);
            });

            branchCancel.addEventListener('click', function () {
                branchVerification.classList.remove('visible');
                branchMessage.innerHTML = "";
            });

            let ghCloneAndBranch = async (dir, branchMessage, branchBranch) => {
                let url = "https://github.com/" + branchRepoOwner.value + "/" + branchRepoName.value + '.git';
                const onAuth = () => ({
                    username: localStorage.getItem('gh-settings-user-name'),
                    password: localStorage.getItem('gh-settings-token')
                });
                let baseRepoCreate = await ghClone(onAuth, url, dir, branchMessage, branchBranch);
                if (baseRepoCreate) {
                    let successMessage = document.createElement('p');
                    successMessage.innerHTML = 'Repo successfully cloned.';
                    branchMessage.appendChild(successMessage);
                    let currentBranch = (branchBranchName.value === '' || branchBranchName.value === undefined) ? 'main' : branchBranchName.value;
                    let args = {
                        octokit: octokit,
                        owner: branchRepoOwner.value,
                        repo: branchRepoName.value,
                        currentBranch,
                        newBranch: branchNewName.value
                    }
                    let currentSha = await ghGetCurrentCommit(args);

                    let createBranch = await ghCreateRef(args, currentSha.commitSha);
                    branchMessage.innerHTML = '<p>Branch created and reference updated.</p>';
                    let projectData = {
                        repo: args.repo,
                        owner: args.owner,
                        branch: args.newBranch
                    }
                    ghCreateJsonFile(projectData, dir, 'githubinfo.json');
                    ghWriteGitConfig(dir);
                }
            }
        }

        let ghManipulateForkFields = async () => {
            let closeButton = ghById('gh-fork-close');
            let forkOwner = ghById('gh-fork-repo-owner');
            let forkNameField = ghById('gh-fork-repo-name');
            let forkSaveFolderButton = ghById('gh-fork-get-save-folder');
            let forkSaveLocation = ghById('gh-fork-save-location');
            let forkNewFolderName = ghById('gh-fork-folder-name');
            let forkFolderVerification = ghById('gh-fork-verification')
            let forkOkayButton = ghById('gh-fork-folder-okay');
            let forkReset = ghById('gh-fork-reset-button');
            let forkButton = ghById('gh-fork-button');
            let loginError = ghById('gh-fork-log-error');
            let forkMessage = ghById('gh-fork-message-box');
            let mainOwner = '';

            let logCheck = await ghVerifyGitHubAccount();

            if (logCheck !== true) {
                loginError.style.visibility = 'visible';
            } else {
                loginError.style.visibility = 'hidden';
                mainOwner = localStorage.getItem('gh-settings-user-name')
            }

            forkMessage.innerHTML = '<p>No message at this time</p>';

            forkSaveFolderButton.addEventListener('click', () => {
                openFolderExplorer(window, (selection) => {
                    forkSaveLocation.innerHTML = selection;
                });
            });

            forkNameField.addEventListener('input', () => forkNewFolderName.value = forkNameField.value);

            forkReset.addEventListener('click', () => {
                forkMessage.innerHTML = '<p>No message at this time</p>';
            });

            closeButton.addEventListener('click', () => {
                forkReset.click();
            });

            forkButton.addEventListener('click', async () => {
                if (logCheck !== true) return;
                if (forkOwner.value === '' || forkNameField === '') return;

                let octokit = await ghCreateOctokitInstance();

                let newFork = await octokit.rest.repos.createFork({
                    owner: forkOwner.value,
                    repo: forkNameField.value
                });
                ghStatusUpdate(newFork.status, forkMessage, 'Repo forked - creating local clone.');

                let dir = Path.join(forkSaveLocation.innerHTML, forkNewFolderName);
                let dirCheck = fse.existsSync(dir);
                if (dirCheck) {
                    forkFolderVerification.classList.add('visible');
                    cloneMessage.innerHTML = "<p>Please verify existing folder overwrite.</p>";
                } else {
                    let url = "https://github.com/" + mainOwner + "/" + forkNameField.value + '.git';
                    const onAuth = () => ({
                        username: mainOwner,
                        password: localStorage.getItem('gh-settings-token')
                    });
                    let forkRepo = await ghClone(onAuth, url, dir, forkMessage, '');
                    if (forkRepo) {
                        let successMessage = document.createElement('p');
                        successMessage.innerHTML = 'Local copy created';
                        forkMessage.appendChild(successMessage);
                        let projectData = {
                            repo: forkNameField.value,
                            owner: mainOwner,
                            branch: 'main'
                        };
                        ghCreateJsonFile(projectData, dir, 'githubinfo.json');
                        ghWriteGitConfig(dir);
                        let content = '_pgbackup';
                        let ignoreFile = Path.join(dir, '.gitignore');
                        try {
                            const gitIgnore = fse.writeFileSync(ignoreFile, content);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }

                forkOkayButton.addEventListener('click', async () => {
                    cloneMessage.innerHTML = '';
                    let forkDir = Path.join(forkSaveLocation.innerHTML, forkNewFolderName);
                    let url = "https://github.com/" + mainOwner + "/" + forkNameField.value + '.git';
                    const onAuth = () => ({
                        username: mainOwner,
                        password: localStorage.getItem('gh-settings-token')
                    });
                    let forkRepo = await ghClone(onAuth, url, forkDir, forkMessage, '');
                    if (forkRepo) {
                        let successMessage = document.createElement('p');
                        successMessage.innerHTML = 'Local copy created';
                        forkMessage.appendChild(successMessage);
                        let projectData = {
                            repo: forkNameField.value,
                            owner: mainOwner,
                            branch: 'main'
                        };
                        ghCreateJsonFile(projectData, forkDir, 'githubinfo.json');
                        ghWriteGitConfig(forkDir);
                        let content = '_pgbackup';
                        let ignoreFile = Path.join(forkDir, '.gitignore');
                        try {
                            const gitIgnore = fse.writeFileSync(ignoreFile, content);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                });
            })
        };

        //Function to gather staging and commit information.
        let ghManipulateCommitFields = () => {
            let projectDirectory = ghProjectDirectory();
            let gitStatus = ghById('gh-commit-git-status-box');
            let statusButton = ghById('gh-status-button');
            let commitMessageBox = ghById('gh-commit-message-box');
            let directoryHead = ghById('ghProjectTree');
            let directoryFolders = directoryHead.querySelectorAll('[data-gh-type="folder"]');
            directoryFolders.forEach(folder => {
                let folderIcon = folder.querySelector('i');
                folderIcon.addEventListener('click', function (evt) {
                    folderIcon.classList.contains('icon-right') ? folderIcon.classList.replace('icon-right', 'icon-down') : folderIcon.classList.replace('icon-down', 'icon-right');
                    let fileList = folder.querySelector('ul');
                    fileList.classList.contains('gh-hidden') ? fileList.classList.replace('gh-hidden', 'gh-visible') : fileList.classList.replace('gh-visible', 'gh-hidden');
                })
                let folderInput = folder.querySelector('input');
                folderInput.addEventListener('click', (evt) => {
                    let fileList = folder.querySelector('ul');
                    let fileInputs = fileList.querySelectorAll('li > input');
                    let checkStatus = folderInput.checked;
                    fileInputs.forEach(input => {
                        input.checked = checkStatus ? true : false;
                    });
                });
            });
            let messageError = ghById('gh-commit-message-error');
            let emailError = ghById('gh-commit-email-error');
            let credentialsError = ghById('gh-commit-credentials-error');
            let commitMessage = ghById('gh-commit-message');
            let authorEmail = ghById('gh-commit-email');
            let unstageButton = ghById('gh-unstage-button');
            let stageButton = ghById('gh-stage-button');
            let commitButton = ghById('gh-commit-button');
            let pushButton = ghById('gh-push-button');
            let currentCommitStatus = localStorage.getItem('gh-commited');
            if (currentCommitStatus === true) {
                commitButton.disabled = false;
                commitMessage.disabled = false;
                authorEmail.disabled = false;
            }


            statusButton.addEventListener('click', async () => {
                let stagedFiles = await ghStagedFiles();
                gitStatus.innerHTML = '<p>Currently Staged Files:</p>' + stagedFiles;
            });

            stageButton.addEventListener('click', async () => {
                let filesToStage = ghGetFiles(directoryHead);
                let stageFiles = await ghStageFiles(filesToStage);
                if (stageFiles) {
                    let stagedFiles = await ghStagedFiles();
                    gitStatus.innerHTML = '<p>Currently Staged Files:</p>' + stagedFiles;
                    localStorage.setItem('gh-commited', true);
                    commitButton.disabled = false;
                    commitMessage.disabled = false;
                    authorEmail.disabled = false;
                }
            });

            unstageButton.addEventListener('click', async () => {
                let filesToUnstage = ghGetFiles(directoryHead);
                let unstageFiles = await ghUnstageFiles(filesToUnstage);
                if (unstageFiles) {
                    let stagedFiles = await ghStagedFiles();
                    gitStatus.innerHTML = '<p>Currently Staged Files:</p>' + stagedFiles;
                }
            });

            commitButton.addEventListener('click', async () => {
                let projectDirectory = ghProjectDirectory();
                if (commitMessage.value === '') {
                    messageError.style.display = "block";
                    return;
                }
                let errorCheck = await ghVerifyGitHubAccount();
                if (!errorCheck) {
                    credentialsError.style.display = "block";
                    return;
                }
                if (authorEmail.value === '') {
                    emailError.style.display = "block";
                    return;
                }
                let sha = await Git.commit({
                    fs: fse,
                    dir: projectDirectory,
                    author: {
                        name: localStorage.getItem('gh-settings-user-name'),
                        email: authorEmail.value
                    },
                    message: commitMessage.value
                });
                if (sha) {
                    let content = {
                        "committed": true
                    };
                    let filename = "githubinfo.json";
                    let appendCommit = ghAppendJsonFile(content, projectDirectory, filename);
                }
                commitMessageBox.innerHTML = "<p>Files committed by " + localStorage.getItem('gh-settings-user-name') + " as SHA " + sha + "</p>";
            });

            pushButton.addEventListener('click', async () => {
                let projectDirectory = ghProjectDirectory();
                let errorCheck = await ghVerifyGitHubAccount();
                if (!errorCheck) {
                    credentialsError.classList = 'gh-visible gh-error';
                    return;
                }
                let jsonData = ghReadJsonFile(projectDirectory, 'githubinfo.json');
                if (!jsonData.committed) {
                    commitMessageBox.innerHTML = "<p>No files committed. Please make a commit and try again.</p>";
                    return;
                }
                const onAuth = () => ({
                    username: localStorage.getItem('gh-settings-user-name'),
                    password: localStorage.getItem('gh-settings-token')
                });
                let pushRequest = await Git.push({
                    fs: fse,
                    http,
                    dir: projectDirectory,
                    onAuth,
                    author: {
                        name: localStorage.getItem('gh-settings-user-name')
                    }
                });
                let content = {
                    "committed": false
                };
                ghAppendJsonFile(content, projectDirectory, 'githubinfo.json');
            });

            let cancelButton = ghById('gh-commit-cancel');
            let closeButton = ghById('gh-commit-x');
            let resetModal = () => {
                let commitDynamicContainer = ghById('gh-commit-dynamic-container');
                if (commitDynamicContainer) commitDynamicContainer.remove();
                messageError.style.display = "none";
                credentialsError.style.display = "none";
                emailError.style.display = "none";
                gitStatus.innerHTML = '';
                commitMessage.value = '';
                authorEmail.value = '';
            };
            [cancelButton, closeButton].forEach(button => {
                button.addEventListener('click', resetModal);
            });
            cancelButton.addEventListener('click', () => {
                closeButton.removeEventListener('click', resetModal);
            });
            closeButton.addEventListener('click', () => {
                cancelButton.removeEventListener('click', resetModal);
            });
        };

        let ghManipulatePullFields = () => {
            let projectDirectory = ghProjectDirectory();
            let messageArea = ghById('gh-pull-message-box');
            let pullButton = ghById('gh-pull-button');
            let closeX = ghById('gh-pull-x');
            let cancelButton = ghById('gh-pull-cancel');
            let pullIt = () => {
                return Git.pull({
                        fs: fse,
                        http,
                        dir: projectDirectory,
                        singleBranch: true
                    })
                    .then(() => messageArea.innerHTML = ('Pull successful'))
                    .catch(err => {
                        console.error(err);
                    });
            };
            pullButton.addEventListener('click', pullIt);
            closeX.addEventListener('click', () => {
                cancelButton.click();
            });
            cancelButton.addEventListener('click', () => {
                messageArea.innerHTML = "";
            })

        }

        //Function to add all the initial field listeners to each modal
        let ghAddFieldsListeners = () => {
            ghManipulateSettingsFields();
            ghManipulateCreateFields();
            ghManipulateCloneFields();
            ghManipulateBranchFields();
            ghManipulateForkFields();
        }

        //Function to add the click listeners to the initial menu items
        let ghAddModalListener = ({
            targetId,
            modalName
        }) => {
            //Adds the click listener to the settings menu item
            let modalItem = ghById(targetId);
            let modalId = '#gh-' + modalName + '-modal';

            modalItem.addEventListener('click', () => $(modalId).modal('show'));
        };


        let ghGetFileAsBASE64 = (filePath) => fse.readFile(filePath, 'base64');

        let ghSetBranchToCommit = ({
            octokit,
            owner,
            repo,
            currentBranch
        }, commitSha) => octokit.git.updateRef({
            owner,
            repo,
            ref: `heads/${currentBranch}`,
            sha: commitSha
        });


        //HTML for the main menu
        let $menu = $(`
        <li id="github-menu" class="dropdown">
            <a href="#" class="dropdown-toggle" data-toggle="dropdown"><span>GitHub</span></a>
            <ul class="dropdown-menu" id="gh-dropdown">
            <li><a href="#" id="gh-create-repo">Create New Repo</a></li>
            <li><a href="#" id="gh-clone-repo">Clone Existing Repo</a></li>
            <li><a href="#" id="gh-branch-repo">Branch Existing Repo</a></li>
            <li><a href="#" id="gh-fork-repo">Fork Existing Repo</a></li>
                <hr id="ruler-one">
                <li><a href="#" id="gh-settings">Settings...</a></li>
            </ul>
        </li>
        `);

        //Adds the main GitHub menu to Pinegrow upon open
        pinegrow.addPluginControlToTopbar(framework, $menu, true, function () {
            ghAddStyling();
            ghAddTheModals();
        });

        // Check if we are opening another project in a new window 
        if (pinegrow.getCurrentProject()) {
            addToGHMenu();
        }


        //Adds project specific GitHub menu items 
        //Replaced anonymous callback function with 'addToGHMenu' to solve problem with opening
        //project in a new window not triggering menu addition 
        pinegrow.addEventHandler('on_project_loaded', addToGHMenu);
        //Removes extra menu items on project close
        pinegrow.addEventHandler('on_project_closed', removeFromGHMenu);

        //Function to add the styling to the page
        function ghAddStyling() {
            let styleLink = document.createElement('link');
            styleLink.setAttribute('rel', 'stylesheet');
            let styleFile = framework.getResourceUrl('./assets/style.css');
            styleLink.setAttribute('href', styleFile);
            const theApp = ghById('pgapp');
            theApp.appendChild(styleLink);
        }


        //Function to add modals to the page
        async function ghAddModal({
            targetId,
            modalName
        }) {
            let modalDiv = document.createElement('div');
            let modalId = modalName + 'ModalContainer';
            modalDiv.setAttribute('id', modalId);
            const theApp = ghById('pgapp');
            theApp.appendChild(modalDiv);
            let modalFile = crsaMakeFileFromUrl(frameBase + '/assets/' + modalName + '.html');
            let settingsModalContainer = ghById(modalId);
            settingsModalContainer.innerHTML = await ghFetchHtmlFragment(modalFile);
            ghAddModalListener({
                targetId: targetId,
                modalName: modalName
            });
        }

        async function ghAddTheModals() {
            let initialModals = [{
                    targetId: 'gh-create-repo',
                    modalName: 'create'
                },
                {
                    targetId: 'gh-clone-repo',
                    modalName: 'clone'
                },
                {
                    targetId: 'gh-branch-repo',
                    modalName: 'branch'
                },
                {
                    targetId: 'gh-fork-repo',
                    modalName: 'fork'
                },
                {
                    targetId: 'gh-settings',
                    modalName: 'settings'
                }
            ];
            await Promise.all(initialModals.map((modal) => {
                ghAddModal(modal);
            }));
            ghAddFieldsListeners();
        }

        async function addToGHMenu() {
            // first check existence of additional menu to avoid double entries to the GH Menu
            if (!ghById('stage-changes')) {
                let targetMenu = ghById('gh-dropdown');
                let newItem = document.createDocumentFragment();
                let listOne = document.createElement('li');
                listOne.innerHTML = '<a href="#" id="gh-stage-changes">Stage, Commit, and Push Changes</a>'
                newItem.appendChild(listOne);
                let listTwo = document.createElement('li');
                listTwo.innerHTML = '<a href="#" id="gh-pull-changes">Pull changes</a>';
                newItem.appendChild(listTwo);
                // rjs: using namedItem is more robust then using hardcoded index-number
                // rjs: this namedItem needs an id on the element <hr> in the menu
                let menuDivider = targetMenu.children.namedItem('ruler-one');
                targetMenu.insertBefore(newItem, menuDivider);
                let stageModal = {
                    targetId: 'gh-stage-changes',
                    modalName: 'commit'
                };
                await ghAddModal(stageModal);
                ghAddStageListener(stageModal);
                await ghCreateRepoModal();
                await ghTestStatus();
                ghManipulateCommitFields();
                let pullModal = {
                    targetId: 'gh-pull-changes',
                    modalName: 'pull'
                };
                await ghAddModal(pullModal);
                ghManipulatePullFields();
            }
        }

        function removeFromGHMenu(pagenull, project) {
            ghById('gh-stage-changes').remove();
            ghById('gh-pull-changes').remove();
            ghById('commitModalContainer').remove();
        }

        async function ghVerifyGitHubAccount() {
            if (localStorage.getItem('gh-settings-token') && localStorage.getItem('gh-settings-user-name')) {
                //instantiates octokit object with token authorization
                let octokit = await ghCreateOctokitInstance();
                let userName = localStorage.getItem('gh-settings-user-name');
                return octokit.users.getAuthenticated()
                    .then(isAuthenticated => isAuthenticated.data.login)
                    .then(returnedName => (userName === returnedName) ? true : -1)
                    .catch(err => console.error(err));
            }
        }

        async function ghCreateRepo(repoArgs) {
            //instantiates octokit object with token authorization
            let octokit = await ghCreateOctokitInstance();
            return octokit.rest.repos.createForAuthenticatedUser(repoArgs).catch(err => {
                console.error(err);
                return {
                    "status": "error"
                };
            });
        }

        async function ghCreateRepoModal() {
            let ghProject = await ghGetDirectory();
            let directoryContainer = document.getElementById('ghDirectoryContainer');
            directoryContainer.innerHTML = '';
            const element = document.createElement('div');
            element.setAttribute('class', 'gh-file-selection');
            element.setAttribute('id', 'gh-commit-dynamic-container');
            const ghContent = document.createElement('div');
            ghContent.setAttribute('class', 'gh-project-directory gh-project-list');
            const title = document.createElement('h2');
            title.textContent = ghProject.name;
            ghContent.appendChild(title);
            const target = document.createElement('ul');
            target.setAttribute('id', 'ghProjectTree');
            ghContent.appendChild(target);
            element.appendChild(ghContent);
            directoryContainer.appendChild(element);
            await ghCreateDirectory(ghProject.children);
        }

        async function ghCreateDirectory(ghProjectChildren) {
            let cleanProject = await ghCleanChildren(ghProjectChildren);
            let projectDirectory = ghProjectDirectory();
            const projectTree = (targetElement, children) => {
                children.forEach(async function (child) {
                    if (child.type === 'directory') {
                        let dirSet = document.createElement('li');
                        dirSet.setAttribute('draggable', 'draggable');
                        dirSet.className = 'project-item folder folder-closed';
                        let folderIcon = document.createElement('i');
                        folderIcon.className = 'folder-icon icon icon-right';
                        dirSet.append(folderIcon);
                        let dirSelect = document.createElement('input');
                        dirSelect.setAttribute('type', 'checkbox');
                        dirSet.append(dirSelect);
                        dirSet.append(document.createTextNode(child.name));
                        dirSet.setAttribute('data-gh-file-name', child.name);
                        dirSet.setAttribute('data-gh-url', child.path);
                        dirSet.setAttribute('data-gh-type', 'folder');
                        let subDir = document.createElement('ul');
                        subDir.className = 'gh-hidden';
                        dirSet.append(subDir);
                        targetElement.append(dirSet);
                        projectTree(subDir, child.children);
                        return;
                    }
                    let fileWrap = document.createElement('li');
                    let fileStatus = await ghGitStatus(projectDirectory, child.path);
                    let disabled = !fileStatus.unstaged;
                    fileWrap.className = 'project-item file';
                    if (disabled) fileWrap.classList.add('gh-disabled');
                    fileWrap.setAttribute('data-gh-type', 'file');
                    fileWrap.setAttribute('data-gh-file-name', child.name);
                    fileWrap.setAttribute('data-gh-url', child.path);
                    fileWrap.setAttribute('data-gh-status', fileStatus.status);
                    let fileSelect = document.createElement('input');
                    fileSelect.setAttribute('type', 'checkbox');
                    //if (disabled) fileSelect.setAttribute('disabled', 'disabled');
                    fileWrap.append(fileSelect);
                    fileWrap.append(document.createTextNode(child.name));
                    targetElement.append(fileWrap);
                });
            };
            const ghDiv = ghById('ghProjectTree');
            projectTree(ghDiv, cleanProject);
        }

        function ghGetDirectory() {
            let project = pinegrow.getCurrentProject();
            let path = project.root.path;
            return ghDirTree(path);
        }

        function ghGetFilePath(fileName) {
            return project.getAbsolutePath(fileName);
        }

        function ghGetRelativeUrl(fileName) {
            return project.getAbsolutePath(fileName);
        }

        function ghCreateJsonFile(content, path, name) {
            let jsonData = JSON.stringify(content, null, 2);
            let jsonFile = Path.join(path, name);
            try {
                fse.writeFileSync(jsonFile, jsonData);
            } catch (err) {
                console.error(err);
            }
        }

        function ghReadJsonFile(path, filename) {
            let jsonFile = crsaMakeFileFromUrl(Path.join(path, filename));
            if (fse.existsSync(jsonFile)) {
                try {
                    let projectInfo = fse.readJsonSync(jsonFile);
                    return projectInfo;
                } catch (err) {
                    console.error(err);
                }
            }
            return false;
        }

        function ghAppendJsonFile(content, path, filename) {
            let jsonFile = crsaMakeFileFromUrl(Path.join(path, filename));
            let projectInfo = fse.readJsonSync(jsonFile);
            let newInfo = Object.assign(projectInfo, content);
            let jsonData = JSON.stringify(newInfo, null, 2);
            try {
                fse.writeFileSync(jsonFile, jsonData);
            } catch (err) {
                console.error(err);
            }
        }

        async function ghClone(onAuth, url, dir, messageBox, cloneBranch) {
            try {
                let args = {
                    fs: fse,
                    http,
                    dir,
                    onAuth,
                    url,
                    onProgress(evt) {
                        //console.log(evt);
                        let update = document.createElement('p');
                        let total = (evt.total === undefined) ? '' : '/' + evt.total;
                        update.innerHTML = ('<span>' + evt.phase + ' ' + evt.loaded + total);
                        messageBox.appendChild(update);
                    },
                    onMessage(evt) {
                        //console.log(evt);
                    },
                    onAuthSuccess(evt) {
                        let update = document.createElement('p');
                        update.innerHTML = 'Authorization successful';
                        messageBox.appendChild(update);
                    },
                    onAuthFailure(evt) {
                        let update = document.createElement('p');
                        update.innerHTML = 'Authorization error, please check token and repo privacy settings.';
                        messageBox.appendChild(update);
                    }
                };
                if (cloneBranch != '') {
                    args.ref = cloneBranch;
                    args.singleBranch = true;
                }
                const gitClone = await Git.clone(args);
                return true;
            } catch (error) {
                let update = document.createElement('p');
                update.innerHTML = error.data.response;
                messageBox.appendChild(update);
                fse.rmdir(dir, (err) => {
                    if (err) {
                        throw err;
                    } else {
                        console.error('removed directory', err);
                    }
                })
            }
        }

        async function ghUploadToRepo(projectDirectory, projectData, branch = 'main', commitMessage = 'commit initial files') {
            let octokit = await ghCreateOctokitInstance();
            await ghDelayer(400);
            let args = {
                octokit: octokit,
                owner: projectData.owner,
                repo: projectData.repo,
                currentBranch: branch,
                message: commitMessage
            }
            let currentCommit = await ghGetCurrentCommit(args);
            //does this need further work?
            let gitIgnoreFiles = await ghGetIgnoredFiles(projectDirectory);
            let unfilteredFilesPaths = await glob.sync(projectDirectory + '/**/*', {
                ignore: ['**/.git/**']
            });
            let filesPaths = ghFilterFiles(unfilteredFilesPaths, gitIgnoreFiles);
            let filesBlobs = await Promise.all(filesPaths.map(file => ghCreateBlobForFile(args, file)));
            let pathsForBlobs = await Promise.all(filesPaths.map(fullPath => Path.relative(projectDirectory, fullPath)));
            let newTree = await ghCreateNewTree(args, filesBlobs, pathsForBlobs, currentCommit.treeSha);
            let newCommit = await ghCreateNewCommit(args, newTree.sha, currentCommit.commitSha);
            if (newCommit.status === 201) {
                await ghSetBranchToCommit(args, newCommit.data.sha);
            }
            return newCommit.status;
        }

        async function ghGetCurrentCommit({
            octokit,
            owner,
            repo,
            currentBranch
        }) {
            let refData = await octokit.git.getRef({
                owner,
                repo,
                ref: `heads/${currentBranch}`,
            });
            let commitSha = refData.data.object.sha;
            let commitData = await octokit.git.getCommit({
                owner,
                repo,
                commit_sha: commitSha,
            });
            return {
                commitSha,
                treeSha: commitData.data.tree.sha,
            }
        }

        async function ghCreateBlobForFile({
            octokit,
            owner,
            repo
        }, filePath) {
            let content = await ghGetFileAsBASE64(filePath);
            let blobData = await octokit.git.createBlob({
                owner,
                repo,
                content,
                encoding: 'base64',
            });
            return blobData.data;
        }

        async function ghCreateNewTree({
            octokit,
            owner,
            repo
        }, blobs, paths, parentTreeSha) {
            let tree = blobs.map((blob, index) => {
                let sha = blob.sha;
                return {
                    path: paths[index],
                    mode: '100644',
                    type: 'blob',
                    sha
                };
            });
            let {
                data
            } = await octokit.git.createTree({
                owner,
                repo,
                tree,
                base_tree: parentTreeSha
            });
            return data;
        }

        async function ghCreateNewCommit({
            octokit,
            owner,
            repo,
            message
        }, currentTreeSha, currentCommitSha) {
            return octokit.git.createCommit({
                owner,
                repo,
                message,
                tree: currentTreeSha,
                parents: [currentCommitSha],
            });
        }

        async function ghGetIgnoredFiles(projectDirectory) {
            let theFile = crsaMakeFileFromUrl(Path.join(projectDirectory, '.gitignore'));
            if (fse.existsSync(theFile)) {
                try {
                    return fse.readFile(theFile, 'utf-8');
                } catch (err) {
                    console.error(err);
                }
            }
            return false;
        }

        function ghFilterFiles(unfilteredFiles, ignoredFiles) {
            let filteredFiles = unfilteredFiles;
            if (!ignoredFiles) return filteredFiles;
            ignoredFiles = ignoredFiles.split(',');
            ignoredFiles.forEach((ignoredFile) => {
                filteredFiles = filteredFiles.filter(file => !file.includes(ignoredFile));
            });
            return filteredFiles;
        }

        async function ghFilterChildren(childFiles, ignoredFiles) {
            if (!ignoredFiles) return childFiles;
            ignoredFiles = ignoredFiles.split(',');
            return childFiles.filter(file => !ignoredFiles.includes(file.name));
        }

        function ghDelayer(ms) {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, ms)
            });
        }

        function ghStatusUpdate(status, target, customMessage) {
            let update = document.createElement('p');
            let updateElement;
            switch (status) {
                case 201:
                    updateElement = document.createTextNode('Status: 201 Operation successful ' + customMessage);
                    update.appendChild(updateElement);
                    break;
                case 304:
                    updateElement = document.createTextNode('Status: 304 Repo exists and was not modified');
                    update.appendChild(updateElement);
                    break;
                case 400:
                    updateElement = document.createTextNode('Status: 400 Bad request. Check arguments for special characters');
                    update.appendChild(updateElement);
                    break;
                case 401:
                    updateElement = document.createTextNode('Status: 401 Authentication failed');
                    update.appendChild(updateElement);
                    break;
                case 403:
                    updateElement = document.createTextNode('Status: 403 Forbidden. Check token options');
                    update.appendChild(updateElement);
                    break;
                case 404:
                    updateElement = document.createTextNode('Status: 404 Resource not found.');
                    update.appendChild(updateElement);
                    break;
                case 422:
                    updateElement = document.createTextNode('Status: 422 Repo validation failed.');
                    update.appendChild(updateElement);
                    break;
                case "error":
                    updateElement = document.createTextNode('Status: Repo creation failed with unknown error - possibly the chosen name already exists?');
                    update.appendChild(updateElement);
                    break;
                default:
                    updateElement = document.createTextNode('No message returned');
                    update.appendChild(updateElement);
            }
            target.appendChild(update);
        }

        function ghCreateRef({
            octokit,
            owner,
            repo,
            newBranch
        }, sha) {
            let ref = 'refs/heads/' + newBranch;
            let args = {
                owner,
                repo,
                ref,
                sha
            }
            return octokit.rest.git.createRef(args);
        }

        async function ghCleanChildren(projectChildren) {
            let projectDirectory = ghProjectDirectory();
            let ignoredFiles = await ghGetIgnoredFiles(projectDirectory);
            return ghFilterChildren(projectChildren, ignoredFiles);
        }

        function ghProjectDirectory() {
            let currentProject = pinegrow.getCurrentProject();
            return crsaMakeFileFromUrl(currentProject.getUrl());
        }

        function ghSafeReadDirSync(path) {
            let dirData = {};
            try {
                dirData = fse.readdirSync(path);
            } catch (ex) {
                if (ex.code == "EACCES" || ex.code == "EPERM") {
                    //User does not have permissions, ignore directory
                    return null;
                } else throw ex;
            }
            return dirData;
        }

        function ghDirTree(path) {
            let name = Path.basename(path);
            let item = {
                path,
                name
            };

            let stats;

            try {
                stats = fse.statSync(path);
            } catch (err) {
                console.error(err);
                return null;
            }

            if (stats.isFile()) {
                item.type = 'file';
            } else if (stats.isDirectory()) {
                let dirData = ghSafeReadDirSync(path);
                if (dirData === null) return null;

                item.type = 'directory';

                item.children = dirData
                    .map(child => ghDirTree(Path.join(path, child)))
                    .filter(e => !!e);
            } else {
                return null;
            }
            return item;
        }

        async function ghStageCommits(filesToCommit, commitMessage) {
            let octokit = await ghCreateOctokitInstance();
            let projectDirectory = ghProjectDirectory();
            let jsonData = await ghReadJsonFile(projectDirectory, 'githubinfo.json');
            let args = {
                octokit: octokit,
                owner: jsonData.owner,
                repo: jsonData.repo,
                currentBranch: jsonData.branch,
                message: commitMessage
            }
            let currentCommit = await ghGetCurrentCommit(args);
            let filesBlobs = await Promise.all(filesToCommit.map(file => ghCreateBlobForFile(args, file)));
            let pathsForBlobs = await Promise.all(filesToCommit.map(fullPath => Path.relative(projectDirectory, fullPath)));
            let newTree = await ghCreateNewTree(args, filesBlobs, pathsForBlobs, currentCommit.tree);
            let newCommit = await ghCreateNewCommit(args, newTree.sha, currentCommit.commitSha);
            if (newCommit.status === 201) {
                await ghSetBranchToCommit(args, newCommit.data.sha);
            }
            return newCommit.status;
        }

        function ghStageFiles(filePaths) {
            let projectDirectory = ghProjectDirectory();
            filePaths.forEach(async (path) => {
                let relativePath = Path.relative(projectDirectory, path);
                await Git.add({
                    fs: fse,
                    dir: projectDirectory,
                    filepath: relativePath
                });
            });
            return true;
        }

        async function ghUploadToRepoNew(projectDirectory, projectData, branch = 'main', commitMessage = 'commit initial files') {
            let unfilteredFilesPaths = await glob.sync(projectDirectory + '/**/*', {
                ignore: ['**/.git/**']
            });
            //let filesPaths = ghFilterFiles(unfilteredFilesPaths);
            let filesPaths = unfilteredFilesPaths;
            filesPaths.forEach(async (path) => {
                let relativePath = Path.relative(projectDirectory, path);
                await Git.add({
                    fs: fse,
                    dir: projectDirectory,
                    filepath: relativePath
                });
            });
            let sha = await Git.commit({
                fs: fse,
                dir: projectDirectory,
                author: {
                    name: localStorage.getItem('gh-settings-user-name'),
                    email: localStorage.getItem('gh-settings-email')
                },
                message: commitMessage
            });
            const onAuth = () => ({
                username: localStorage.getItem('gh-settings-user-name'),
                password: localStorage.getItem('gh-settings-token')
            });
            let pushRequest = await Git.push({
                fs: fse,
                http,
                dir: projectDirectory,
                onAuth,
                force: true,
                author: {
                    name: localStorage.getItem('gh-settings-user-name')
                }
            });
        }

        function ghUnstageFiles(filePaths) {
            let projectDirectory = ghProjectDirectory();
            filePaths.forEach(async (path) => {
                let relativePath = Path.relative(projectDirectory, path);
                await Git.remove({
                    fs: fse,
                    dir: projectDirectory,
                    filepath: relativePath
                });
            });
            return true;
        }

        async function ghGitStatus(projectDirectory, filePath) {
            let fileName = Path.relative(projectDirectory, filePath);
            let fileStatus = await Git.status({
                fs: fse,
                dir: projectDirectory,
                filepath: fileName
            });
            let unstagedChanges = ['*modified', '*deleted', '*added', '*unmodified', '*absent', '*undeleted', '*undeletemodified'];
            let stagedChanges = ['modified', 'deleted', 'added'];
            let unstaged = unstagedChanges.includes(fileStatus);
            let staged = stagedChanges.includes(fileStatus)
            return {
                status: fileStatus,
                unstaged: unstaged,
                staged: staged
            };
        }

        async function ghStagedFiles() {
            let projectDirectory = ghProjectDirectory();
            let status = await Git.listFiles({
                fs: fse,
                dir: projectDirectory
            });
            let returnedFiles = [];
            for (let file of status) {
                if (await ghStagedCallback(file)) {
                    returnedFiles.push(file);
                }
            }
            return returnedFiles.join(", ");
        }

        async function ghStagedCallback(file) {
            let projectDirectory = ghProjectDirectory();
            let pathedFile = Path.join(projectDirectory, file);
            let testFile = await ghGitStatus(projectDirectory, pathedFile);
            return testFile.staged;
        }

        async function ghUnstagedFiles() {
            let projectDirectory = ghProjectDirectory();
            let status = await Git.listFiles({
                fs: fse,
                dir: projectDirectory
            });
            let returnedFiles = status.filter(async file => {
                let pathedFile = Path.join(projectDirectory, file);
                let testFile = await ghGitStatus(projectDirectory, pathedFile);
                return (testFile.unstaged ? file : false);
            })
            return returnedFiles.toString();
        }

        async function ghTestStatus() {
            let stagedFiles = await ghStagedFiles();
            if (stagedFiles.length > 0) {
                localStorage.setItem('gh-commited', true);
            } else {
                localStorage.setItem('gh-commited', false);
            }
        }

        //Allows single point creation of octokit instance
        function ghCreateOctokitInstance() {
            try {
                return new Octokit({
                    type: 'token',
                    auth: localStorage.getItem('gh-settings-token'),
                });
            } catch (err) {
                console.error(err);
                return err;
            }
        }

        //Adds function to bring in modal files
        function ghFetchHtmlFragment(htmlLocation) {
            try {
                return fse.readFileSync(htmlLocation, 'utf-8');
            } catch (e) {
                console.error(e);
            }
        }

        //make selecting fields easier by providing shorthand
        function ghById(id) {
            return document.getElementById(id);
        }

        //get selected files from list
        function ghGetFiles(targetList) {
            let returnedFiles = [];
            let selectedFiles = targetList.querySelectorAll('input[type="checkbox"]:checked:not(:disabled)');
            selectedFiles.forEach(file => {
                let fileParent = file.parentNode;
                if (fileParent.getAttribute('type') != 'folder') {
                    returnedFiles.push(fileParent.getAttribute("data-gh-url"));
                }
            });
            return returnedFiles;
        }

        //add user settings to the config file
        function ghWriteGitConfig(projectDirectory) {
            let userName = localStorage.getItem('gh-settings-user-name');
            let email = localStorage.getItem('gh-settings-email');
            let token = localStorage.getItem('gh-settings-token');
            let configValues = new Map([
                ['user.email', email],
                ['user.name', userName],
                ['author.name', userName],
                ['author.email', email],
                ['github.user', userName],
                ['github.token', token]
            ]);
            return ghSetConfig(configValues, projectDirectory);
        }

        async function ghSetConfig(configValues, projectDirectory) {
            for await (let [key, value] of configValues) {
                let writeValue = await Git.setConfig({
                    fs: fse,
                    dir: projectDirectory,
                    path: key,
                    value: value,
                    append: true
                });
            }
        }

        async function ghWriteConfig(configValues, projectDirectory) {
            let fileName = crsaMakeFileFromUrl(Path.join(projectDirectory, '.git', 'config'));
            let fileCheck = fse.existsSync(fileName);
            if (!fileCheck) return;
            try {
                fse.appendFileSync(fileName, configValues);
            } catch (err) {
                console.error(err);
            }
        }

        //check if the gitconfig file exists
        async function ghFetchGitConfig(projectDirectory) {
            let fileName = crsaMakeFileFromUrl(Path.join(projectDirectory, '.git', 'config'));
            let fileCheck = fse.existsSync(fileName);
            if (!fileCheck) return;
            return ghReadGitConfig(projectDirectory);
        }

        //Read the gitconfig file and return the credentials
        async function ghReadGitConfig(projectDirectory) {
            let ghCredentials = {};
            ghCredentials.userName = await Git.getConfig({
                fs: fse,
                dir: projectDirectory,
                path: 'github.user'
            });
            ghCredentials.userToken = await Git.getConfig({
                fs: fse,
                dir: projectDirectory,
                path: 'github.token'
            });
            return ghCredentials;
        }

        //delete the config file
        function ghDeleteGitConfig(projectDirectory) {
            let theFile = crsaMakeFileFromUrl(Path.join(projectDirectory, '.gitconfig'));
            fse.remove(theFile, (err) => {
                if (err) return console.error(err);
            });
        }

        function ghSanitizeRepoName(name) {
            let regex = /[A-Za-z0-9-_. ]/;
            let sanitizedName = name.split('').filter(letter => regex.test(letter));
            let spaces = / /g;
            let fullSani = sanitizedName.join('').replace(spaces, "-");
            return fullSani;
        }

        function ghAddStageListener({
            targetId,
            modalName
        }) {
            let modalItem = ghById(targetId);
            let modalId = '#gh-' + modalName + '-modal';
            modalItem.addEventListener('click', async () => {
                await ghCreateRepoModal();
                await ghTestStatus();
                await ghManipulateCommitFields();
                $(modalId).modal('show');
            })
        }
    });
});