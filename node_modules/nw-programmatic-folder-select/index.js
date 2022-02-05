/**
 * Opens the native OS's folder selection dialog
 * @param  {object}   window   The "window" object from the browser context. Required.
 * @param  {object}   options  Optional object for setting the title of the window and the default working directory to start in
 * @param  {Function} callback This is called when the user selects a folder or cancels the window. it will retun the path to the folder or undefined
 */
function openFolderExplorer (window, options, callback) {
  // Argument validation
  var error = false;
  if (
    !window ||
    typeof(window) !== 'object' ||
    Array.isArray(window) ||
    !window.document ||
    !window.document.getElementById
  ) {
    console.log('You must pass in the window object for this script to have access to the browser context.');
    error = true;
  }
  if (typeof(options) === 'function' && !callback) {
    callback = options;
    options = null;
  }
  if (
    options &&
    (typeof(options) === 'function' && typeof(callback) === 'function') ||
    (typeof(options) !== 'object' || Array.isArray(options))
  ) {
    console.log('Optional options argument must be an object');
    error = true;
  }
  if (options && typeof(options) === 'object' && !Array.isArray(options)) {
    if (options.directory && typeof(options.directory) !== 'string') {
      console.log('Optional options.directory must be a string, like "C:\\"');
      error = true;
    }
    if (options.title && typeof(options.title) !== 'string') {
      console.log('Optional options.title must be a string, like "Select path to store settings"');
      error = true;
    }
  }
  if (callback && typeof(callback) !== 'function') {
    console.log('Optional callback argument must be a function');
    error = true;
  }
  // If there are invalid arguments, return early to prevent errors from being thrown
  if (error) {
    return;
  }


  // Constants
  var ELEMENT_ID = 'nw-programmatic-folder-select';
  var NW_DIRECTORY = 'nwdirectory';
  var NW_DIRECTORY_DESCRIPTION = 'nwdirectorydesc';
  var NW_WORKING_DIRECTORY = 'nwworkingdir';

  // If element does not exist, create it and append to DOM
  if (!window.document.getElementById(ELEMENT_ID)) {
    var inputElement = window.document.createElement('input');
    inputElement.setAttribute('type', 'file');
    inputElement.setAttribute('id', ELEMENT_ID);
    inputElement.setAttribute(NW_DIRECTORY, '');
    inputElement.setAttribute('style', 'display:none');
    inputElement.addEventListener('change', function (evt) {
      if (callback) {
        callback(evt.target.value);
      }
    });
    window.document.body.appendChild(inputElement);
  }

  // Modify element based on options
  var element = window.document.getElementById(ELEMENT_ID);
  if (options && options.directory) {
    element.setAttribute(NW_WORKING_DIRECTORY, options.directory);
  } else {
    element.removeAttribute(NW_WORKING_DIRECTORY);
  }
  if (options && options.title) {
    element.setAttribute(NW_DIRECTORY_DESCRIPTION, options.title);
  } else {
    element.removeAttribute(NW_DIRECTORY_DESCRIPTION);
  }

  // Clear out the previous value before opening the dialogu to work around
  // a bug where a transformed version of the previous value is shown in the
  // dialog like 'C__Users_Bob_Desktop'. See: github.com/nwjs/nw.js/issues/7786
  if (element && element.files && element.files.clear) {
    element.files.clear();
  }

  // Trigger a click event to cause the dialog to open
  element.click();
}

module.exports = openFolderExplorer;
