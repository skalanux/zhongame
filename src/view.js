(function () {

const DB_NAME = 'zhongame';
const DB_VERSION = 1; // Use a long long for this value (don't use a float)
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
var hanzi_list = [];
var current_hanzi_index = 0;
var total_hanzi_elements = 0;



function shuffle(o){ //v1.0
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

function clearHanziCanvas(){
  var pub_canvas = $('#p-game-canvas');
  pub_canvas.empty();

  var pub_input = $('#input-game-input');
  pub_input.val("");

  var flash_card = $('#result-flashcard');
  flash_card.empty();


}

function displayHanzi(hanzi_id){
  clearHanziCanvas();
  var pub_canvas = $('#p-game-canvas');
  current_hanzi_index = hanzi_id;
  pub_canvas.html(hanzi_list[hanzi_id]);

}

function startHanziGame() {
  console.log("displayPubList");

  hanzi_list = [];
  current_hanzi_index = 0;
  total_hanzi_elements = 0;

  store = getObjectStore(DB_STORE_NAME, 'readonly');



  var i = 0;
  req = store.openCursor();
  req.onsuccess = function(evt) {
    var cursor = evt.target.result;

    // If the cursor is pointing at something, ask for the data
    if (cursor) {

      req = store.get(cursor.key);
      req.onsuccess = function (evt) {
        hanzi_list.push(cursor.key);
      };

      cursor.continue();

      // This counter serves only to create distinct ids
      i++;
    }else{

        total_hanzi_elements = i;
    };


    hanzi_list = shuffle(hanzi_list);

    displayHanzi(0);


    console.log("displayPubList cursor:", cursor);
  };
};


function checkHanziMatch(current_hanzi, input_text){
  store = getObjectStore(DB_STORE_NAME, 'readonly');

  var index = store.index("hanzi");

  console.log(index);

  index.get(current_hanzi).onsuccess = function(event) {
    var result_flash_card = $('#result-flashcard');
    if (event.target.result.pinyin==input_text){
      result_flash_card.css('color', 'green');
      result_flash_card.html("非常好!");
    }else
    {
      result_flash_card.css('color', 'red');
      result_flash_card.html("不好");
    }

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

  $("#btn-start-hanzi").click(function(evt) {
    $('#game-name').html("Guess the 汉字");
    $('#input-game-input').focus();

    startHanziGame();
  });

  $("#btn-hanzi-next").click(function(evt) {
    current_hanzi_index += 1;

    if (total_hanzi_elements<=current_hanzi_index){
        current_hanzi_index = 0;
        hanzi_list = shuffle(hanzi_list);
    };

    displayHanzi(current_hanzi_index);

  });


  $("#btn-start-translate").click(function(evt) {
    alert("Coming Soon");
  });

  $("#btn-start-shenme").click(function(evt) {
    alert("Coming Soon");
  });


  $('#input-game-input').keypress(function(event) {
    if (event.keyCode == 13) {
      var input_text = $("#input-game-input").val();
      var current_hanzi = $("#p-game-canvas").html();
      checkHanziMatch(current_hanzi, input_text);
    }
  });




}

openDb();
addEventListeners();

})(); // Immediately-Invoked Function Expression (IIFE)
