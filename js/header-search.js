function loadSearch(input, keywords) {
    var suggestIndex = new FlexSearch({
        encode: "icase",
        tokenize: "forward",
        doc: {
            id: "id",
            field: "keyword",
        },
    });

    var indices = {
        suggest: suggestIndex,
    };

    indices["suggest"].add(keywords);

    input.addEventListener("keyup", function (event) {
        switch (event.key) {
            case "Enter":
            case "Up":
            case "ArrowUp":
            case "Down":
            case "ArrowDown":
            case "Left":
            case "ArrowLeft":
            case "Right":
            case "ArrowRight":
                break;
            case "Escape":
                hideAutocomplete();
                break;
            default:
                if (this.value && this.value.length > 1) {
                    executeSearch(indices, this.value);
                }
        }
    });

    input.addEventListener("blur", () => {
        setTimeout(hideAutocomplete, 100);
    });

    input.addEventListener("focus", () => {
        clearAutocomplete();
        input.dispatchEvent(new KeyboardEvent("keyup"));
    });

    var currentFocus = -1;
    var items = getItems();

    input.addEventListener("keydown", function (event) {
        switch (event.key) {
            case "Enter":
                event.preventDefault(); // prevent the form from being submitted
                if (currentFocus > -1) {
                    items[currentFocus].click();
                    currentFocus = -1;
                } else {
                    handleSubmit(this.value);
                }
                break;
            case "Up": // IE/Edge specific value
            case "ArrowUp":
                currentFocus--;
                addActive(items, currentFocus);
                break;
            case "Down": // IE/Edge specific value
            case "ArrowDown":
                currentFocus++;
                addActive(items, currentFocus);
                break;
            default:
        }
    });

    for (var item of items) {
        item.addEventListener("touchstart", handleClick);
        item.addEventListener("click", handleClick);
    }
}

function executeSearch(indices, searchQuery) {
    var suggestResults = indices["suggest"].search({
        query: searchQuery,
        limit: 10,
    });
    
    clearAutocomplete();
    filterAutocomplete(suggestResults);
}

function handleSubmit(value) {
    if (typeof history.pushState !== "undefined") {
        document.location = window.location.origin + "/search/?s=" + value;
    } else {
        var url = "TODO";
        window.location.assign(url);
    }
}

// Autocomplete ------------------------------------------------------------------------

function hideAutocomplete() {
    var list = document.getElementById("searchInputautocomplete-list");
    if (list) {
        list.style = "display: none";
    }
}

function clearAutocomplete() {
    var items = getItems();
    for (var i = items.length - 1; i > -1; i--) {
        items[i].parentNode.removeChild(items[i]);
    }
}

function filterAutocomplete(values) {
    var added = false;
    var input = document.getElementById("searchInput");
    values.forEach((value, _key) => {
        if (value.keyword != input.value) {
            addItem(value.keyword);
            added = true;
        }
    });

    if (!added) {
        hideAutocomplete();
    }
}

function addItem(value) {
    var item = document.createElement("DIV");

    item.innerHTML = value;

    item.addEventListener("touchstart", handleClick);
    item.addEventListener("click", handleClick);

    var list = document.getElementById("searchInputautocomplete-list");
    if (list) {
        list.appendChild(item);
        list.style = "";
    }
}

function handleClick(event) {
    event.preventDefault(); // so that two click events aren't registered
    var input = document.getElementById("searchInput");
    var currentValue = this.innerHTML;
    input.value = currentValue;
    clearAutocomplete();
    input.dispatchEvent(new KeyboardEvent("keyup"));
    input.focus();
    handleSubmit(currentValue);
}

function addActive(items, currentFocus) {
    if (!items) return false;

    removeActive(items);
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) {
        currentFocus = -1;
    } else {
        items[currentFocus].classList.add("autocomplete-active");
    }
}

function removeActive() {
    var items = getItems();
    for (var item of items) {
        item.classList.remove("autocomplete-active");
    }
}

function getItems() {
    var items = document.getElementById("searchInputautocomplete-list");
    if (items) {
        items = items.getElementsByTagName("div");
        if (items) return items;
    } else {
        console.warn("searchInputautocomplete-list not found");
    }
}

function setInnerHTMLOfID(id, str) {
    const elem = document.getElementById(id);
    if (elem) {
        elem.innerHTML = str;
    } else {
        console.warn("Failed to find: " + id + " for innerHTML");
    }
}

document.addEventListener("DOMContentLoaded", function () {
    var input = document.getElementById("searchInput");
    var button = document.getElementById("searchButton");
    if (button) {
        button.addEventListener("click", () => {
            handleSubmit(input.value);
        });
    }

    Promise.all([fetch("/data/keywords.json")])
        .then(function (responses) {
            // Get a JSON object from each of the responses
            return Promise.all(responses.map((response) => response.json()));
        })
        .then((data) => loadSearch(input, ...data));
});
