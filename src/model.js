(function () {

const DB_NAME = 'zhongame-test5';
const DB_VERSION = 2; // Use a long long for this value (don't use a float)
const DB_STORE_NAME = 'hanzi';

var db;

// Used to keep track of which view is displayed to avoid to uselessly reload it
var current_view_pub_key;

function openDb() {
  console.log("openDb ...");
  var req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onsuccess = function (evt) {
    // Better use "this" than "req" to get the result to avoid problems with
    // garbage collection.
    // db = req.result;
    db = this.result;
    console.log("openDb DONE");
  };
  req.onerror = function (evt) {
    console.error("openDb:", evt.target.errorCode);
  };

  req.onupgradeneeded = function (evt) {
    console.log("openDb.onupgradeneeded");
    var store = evt.currentTarget.result.createObjectStore(
        DB_STORE_NAME, { keyPath: 'hanzi' });

    store.createIndex('hanzi', 'hanzi', { unique: true });
    store.createIndex('pinyin', 'pinyin', { unique: false });
    store.createIndex('hsklevel', 'hsklevel', { unique: false });
    store.createIndex('meaning', 'meaning', { unique: false });
  };
}

/**
 * @param {string} store_name
 * @param {string} mode either "readonly" or "readwrite"
 */
function getObjectStore(store_name, mode) {
  var tx = db.transaction(store_name, mode);
  return tx.objectStore(store_name);
}

function clearObjectStore(store_name) {
  var store = getObjectStore(DB_STORE_NAME, 'readwrite');
  var req = store.clear();
  req.onsuccess = function(evt) {
    displayActionSuccess("Store cleared");
    displayPubList(store);
  };
  req.onerror = function (evt) {
    console.error("clearObjectStore:", evt.target.errorCode);
    displayActionFailure(this.error);
  };
}

function getBlob(key, store, success_callback) {
  var req = store.get(key);
  req.onsuccess = function(evt) {
    var value = evt.target.result;
    if (value)
      success_callback(value.blob);
  };
}

/**
 * @param {IDBObjectStore=} store
 */
function displayPubList(store) {
  console.log("displayPubList");

  if (typeof store == 'undefined')
    store = getObjectStore(DB_STORE_NAME, 'readonly');

  var pub_msg = $('#pub-msg');
  pub_msg.empty();
  var pub_list = $('#pub-list');
  pub_list.empty();
  // Reseting the iframe so that it doesn't display previous content
  newViewerFrame();

  var req;
  req = store.count();
  // Requests are executed in the order in which they were made against the
  // transaction, and their results are returned in the same order.
  // Thus the count text below will be displayed before the actual pub list
  // (not that it is algorithmically important in this case).
  req.onsuccess = function(evt) {
    pub_msg.append('<p>There are <strong>' + evt.target.result +
        '</strong> record(s) in the object store.</p>');
  };
  req.onerror = function(evt) {
    console.error("add error", this.error);
    displayActionFailure(this.error);
  };

  var i = 0;
  req = store.openCursor();
  req.onsuccess = function(evt) {
    var cursor = evt.target.result;

    // If the cursor is pointing at something, ask for the data
    if (cursor) {
      console.log("displayPubList cursor:", cursor);
      req = store.get(cursor.key);
      req.onsuccess = function (evt) {
        var value = evt.target.result;
        var list_item = $('<li>' +
            cursor.key + ":"+ value.pinyin +
            '</li>');
        if (value.meaning != null)
          list_item.append(' - ' + value.meaning);

        if (value.hasOwnProperty('blob') &&
            typeof value.blob != 'undefined') {
              var link = $('<a href="' + cursor.key + '">File</a>');
              link.on('click', function() { return false; });
              link.on('mouseenter', function(evt) {
                setInViewer(evt.target.getAttribute('href')); });
              list_item.append(' / ');
              list_item.append(link);
            } else {
              list_item.append("");
            }
        pub_list.append(list_item);
      };

      // Move on to the next object in store
      cursor.continue();

      // This counter serves only to create distinct ids
      i++;
    } else {
      console.log("No more entries");
    }
  };
}

function newViewerFrame() {
  var viewer = $('#pub-viewer');
  viewer.empty();
  var iframe = $('<iframe />');
  viewer.append(iframe);
  return iframe;
}

function setInViewer(key) {
  console.log("setInViewer:", arguments);
  key = Number(key);
  if (key == current_view_pub_key)
    return;

  current_view_pub_key = key;

  var store = getObjectStore(DB_STORE_NAME, 'readonly');
  getBlob(key, store, function(blob) {
    console.log("setInViewer blob:", blob);
    var iframe = newViewerFrame();

    // It is not possible to set a direct link to the
    // blob to provide a mean to directly download it.
    if (blob.type == 'text/html') {
      var reader = new FileReader();
      reader.onload = (function(evt) {
        var html = evt.target.result;
        iframe.load(function() {
          $(this).contents().find('html').html(html);
        });
      });
      reader.readAsText(blob);
    } else if (blob.type.indexOf('image/') == 0) {
      iframe.load(function() {
        var img_id = 'image-' + key;
        var img = $('<img id="' + img_id + '"/>');
        $(this).contents().find('body').html(img);
        var obj_url = window.URL.createObjectURL(blob);
        $(this).contents().find('#' + img_id).attr('src', obj_url);
        window.URL.revokeObjectURL(obj_url);
      });
    } else if (blob.type == 'application/pdf') {
      $('*').css('cursor', 'wait');
      var obj_url = window.URL.createObjectURL(blob);
      iframe.load(function() {
        $('*').css('cursor', 'auto');
      });
      iframe.attr('src', obj_url);
      window.URL.revokeObjectURL(obj_url);
    } else {
      iframe.load(function() {
        $(this).contents().find('body').html("No view available");
      });
    }

  });
}

/**
 * @param {string} biblioid
 * @param {string} title
 * @param {number} year
 * @param {string} url the URL of the image to download and store in the local
 *   IndexedDB database. The resource behind this URL is subjected to the
 *   "Same origin policy", thus for this method to work, the URL must come from
 *   the same origin than the web site/app this code is deployed on.
 */
function addPublicationFromUrl(hanzi, pinyin, meaning, url) {
  console.log("addPublicationFromUrl:", arguments);

  /*
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  // Setting the wanted responseType to "blob"
  // http://www.w3.org/TR/XMLHttpRequest2/#the-response-attribute
  xhr.responseType = 'blob';
  xhr.onload = function (evt) {
    if (xhr.status == 200) {
      console.log("Blob retrieved");
      var blob = xhr.response;
      console.log("Blob:", blob);
      addPublication(biblioid, title, year, blob);
    } else {
      console.error("addPublicationFromUrl error:",
          xhr.responseText, xhr.status);
    }
  };
  xhr.send();
  */

}


/* In the future I may add pronuntiation, required on level(hsk), etc */
/**
 * @param {string} hanzi
 * @param {string} pinyin
 * @param {string} meaning
 * @param {Blob=} blob
 */
function addPublication(hanzi, pinyin, meaning, hsklevel, blob) {
  console.log("addPublication arguments:", arguments);
  var obj = { hanzi: hanzi, pinyin: pinyin, meaning: meaning, hsklevel:hsklevel };
  if (typeof blob != 'undefined')
    obj.blob = blob;

  var store = getObjectStore(DB_STORE_NAME, 'readwrite');
  var req;
  try {
    req = store.add(obj);
  } catch (e) {
    if (e.name == 'DataCloneError')
      displayActionFailure("This engine doesn't know how to clone a Blob, " +
          "use Firefox");
    throw e;
  }
  req.onsuccess = function (evt) {
    console.log("Insertion in DB successful");
    displayActionSuccess();
    displayPubList(store);
  };
  req.onerror = function() {
    console.error("addPublication error", this.error);
    displayActionFailure(this.error);
  };
}

function displayActionSuccess(msg) {
  msg = typeof msg != 'undefined' ? "Success: " + msg : "Success";
  $('#msg').html('<span class="action-success">' + msg + '</span>');
}
function displayActionFailure(msg) {
  msg = typeof msg != 'undefined' ? "Failure: " + msg : "Failure";
  $('#msg').html('<span class="action-failure">' + msg + '</span>');
}
function resetActionStatus() {
  console.log("resetActionStatus ...");
  $('#msg').empty();
  console.log("resetActionStatus DONE");
}

function addEventListeners() {
  console.log("addEventListeners");

  $('#register-form-reset').click(function(evt) {
    resetActionStatus();
  });

  $('#add-button').click(function(evt) {
    console.log("add ...");
    var hanzi = $('#pub-hanzi').val();
    var pinyin = $('#pub-pinyin').val();
    var meaning = $('#pub-meaning').val();
    var hsklevel = 2;

    if (!hanzi || !pinyin || !meaning) {
      displayActionFailure("Campo(s) requeridos faltantes");
      return;
    }

    addPublication(hanzi, pinyin, meaning, hsklevel);

  });

var search_button = $('#search-list-button');
search_button.click(function(evt) {
  displayPubList();
});

}

openDb();
addEventListeners();

})(); // Immediately-Invoked Function Expression (IIFE)
