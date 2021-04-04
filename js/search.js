function loadSearch(entries, authors, topics, keywords) {
    var entryIndex = new FlexSearch({
        encode: "advanced",
        tokenize: "forward",
        doc: {
            id: "id",
            field: ["title", "abstract"],
        },
    });

    var authorIndex = new FlexSearch({
        encode: "advanced",
        tokenize: "forward",
        doc: {
            id: "id",
            field: "name",
        },
    });

    var topicIndex = new FlexSearch({
        encode: "icase",
        tokenize: "forward",
        doc: {
            id: "id",
            field: "name",
        },
    });

    var suggestIndex = new FlexSearch({
        encode: "icase",
        tokenize: "forward",
        doc: {
            id: "id",
            field: "keyword",
        },
    });

    var indices = {
        entry: entryIndex,
        author: authorIndex,
        topic: topicIndex,
        suggest: suggestIndex,
    };

    indices["entry"].add(entries);
    indices["author"].add(authors);
    indices["topic"].add(topics);
    indices["suggest"].add(keywords);

    const input = document.getElementById("searchInput");

    var searchQuery = input.value;
    if (searchQuery) {
        executeSearch(indices, searchQuery);
    }

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
                } else {
                    hideAutocomplete();
                    hideFindFacts();
                    setInnerHTMLOfID("authorTopic", "");
                    setInnerHTMLOfID(
                        "search-results",
                        "<p>Please enter a word or phrase above</p>"
                    );
                }
        }
    });

    var memoQueryFindFacts = memoizer(queryFindFacts);
    input.addEventListener(
        "keyup",
        debounce(() => {
            var searchTerm = input.value;
            if (searchTerm && searchTerm.length > 2) {
                memoQueryFindFacts(searchTerm).then((results) =>
                    populateFindFactsResults(searchTerm, results)
                );
            }
        }, 300)
    );

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

    async function queryFindFacts(searchTerm) {
        var body = '{"filters":[{"field":"SourceCode","filter":{"Term":{"inner":"';
        body += searchTerm + '"}}}],';
        body += '"fields":["Command","ConstantTypeFacet","Kind","SourceTheoryFacet"],';
        body += '"maxFacets":5}';

        const response = await fetch(
            "https://search.isabelle.in.tum.de/v1/default_Isabelle2021_AFP2021/facet",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    accept: "application/json",
                },
                body: body,
            }
        );
        const data = await response.json();
        return data["Kind"];
    }

    function debounce(callback, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                callback.apply(this, args);
            }, wait);
        };
    }

    function memoizer(fun) {
        let cache = {};
        return function (n) {
            if (cache[n] != undefined) {
                return cache[n];
            } else {
                let result = fun(n);
                cache[n] = result;
                return result;
            }
        };
    }
}

function executeSearch(indices, searchQuery) {
    var entryResults = indices["entry"].search({
        query: searchQuery,
        limit: 16,
    });

    var topicResults = indices["topic"].search({
        query: searchQuery,
        limit: 3,
    });

    var authorResults = indices["author"].search({
        query: searchQuery,
        limit: 3,
    });

    var suggestResults = indices["suggest"].search({
        query: searchQuery,
        limit: 10,
    });

    if (entryResults.length > 0) {
        populateResults(entryResults, searchQuery, indices);
    } else {
        var text =
            "<p>No matches found</p><br>Search on all pages of the AFP, including";
        text += ' PDFs, with <a href="https://www.google.com/search?q=' + searchQuery;
        text += ' site:isa-afp.org" target="_blank" rel="noreferrer noopener">';
        setInnerHTMLOfID("search-results", text);
    }

    setInnerHTMLOfID("authorTopic", "");

    if (authorResults.length > 0)
        populateSmallResults(authorResults, searchQuery, "author", indices);
    if (topicResults.length > 0)
        populateSmallResults(topicResults, searchQuery, "topic", indices);

    clearAutocomplete();
    filterAutocomplete(suggestResults);
}

function populateResults(results, searchQuery, indices, all = false) {
    if (searchQuery.length < 3) {
        hideFindFacts();
    } else {
        var findFacts = document.getElementById("findFacts");
        if (!findFacts) {
            // create FindFacts results table
            findFactsTable = '<div id="findFacts"><h3>FindFacts Results</h3><div';
            findFactsTable += ' id="find-facts-results">...</div></div>';
            document
                .getElementById("authorTopic")
                .insertAdjacentHTML("afterend", findFactsTable);
        } else {
            setInnerHTMLOfID("find-facts-results", "...");
        }
    }

    const resultsTable = document.getElementById("search-results");

    setInnerHTMLOfID("search-results", "<h3>Entries</h3>");

    var limit = all ? results.length : 15;

    results.slice(0, limit).forEach(function (value, resultKey) {
        var topicHrefs = value.topics
            .map((x) => x.toLowerCase())
            .map((x) => x.replace(/\s+/, "-"))
            .map((x) => "/topics/" + x + "/");

        var topics = [];

        value.topics.forEach((value, key) => {
            topics[key] = "<a href=" + topicHrefs[key] + ">" + value + "</a>";
        });

        var topicString = niceList(topics);
        var authorString = niceList(value.authors);

        var title = value.title;
        var link = value.shortname.toLowerCase();
        var shortname = value.shortname;
        var abstract = value.abstract;
        var usedBy = value.usedBy;
        var year = value.date.substring(0, 4);

        var output = `<div id="summary-${resultKey}">
  <div class='title'>
    <a href="/entries/${link}">${title}</a>
    <a download href="https://isa-afp.org/release/afp-${shortname}-current.tar.gz">Download</a>
  </div>
  <div class='subtitle'>
    ${authorString ? `<p>${authorString}</p>` : ""}
    ${year ? `<p>${year}</p>` : ""}
  </div>
  <div class="abstract mathjax_process">${abstract}</div>
    ${ usedBy
        ? `<div>Used by <a href="/dependencies/${link}">${usedBy}</a> | ${
                topicString ? `${topicString} ` : ""
            }</div>`
        : ""
    } ${topicString ? `<div>${topicString}</div>` : ""}
</div>`;

        resultsTable.insertAdjacentHTML("beforeend", output);
    });

    if (results.length > 15 && !all) {
        var btn = document.createElement("button");
        btn.innerHTML = "Show all results";

        btn.addEventListener("click", function () {
            var entryResults = indices["entry"].search({
                query: searchQuery,
            });

            populateResults(entryResults, searchQuery, indices, true);
        });

        resultsTable.appendChild(btn);
    }

    new Mark(resultsTable).mark(searchQuery);

    function niceList(topics) {
        if (topics.length <= 2) {
            topicString = topics.join(" and ");
        } else {
            topicString =
                topics.slice(0, -1).join(", ") + " and " + topics[topics.length - 1];
        }
        return topicString;
    }
}

function hideFindFacts() {
    var findFacts = document.getElementById("findFacts");
    if (findFacts) {
        findFacts.outerHTML = "";
    }
}

function populateSmallResults(results, searchQuery, key, indices, all = false) {
    const maxResults = 5;

    var resultsTable = document.getElementById(key + "-results");
    var name = key[0].toUpperCase() + key.substring(1) + "s";

    if (!resultsTable) {
        var base = '<div id="' + key + '-results">';
        base += "<h3>" + name + "</h3>";

        document.getElementById("authorTopic").insertAdjacentHTML("beforeend", base);
        resultsTable = document.getElementById(key + "-results");
    } else {
        setInnerHTMLOfID(key + "-results", '<td class="head">' + name + "</div>");
    }

    var limit = all ? results.length : maxResults;
    var list = document.createElement("ul");

    results.slice(0, limit).forEach((result, resultKey) => {
        var listElement = document.createElement("li");
        var anchor = document.createElement("a");
        anchor.href = result.link;
        anchor.innerHTML = result.name;
        listElement.appendChild(anchor);
        list.appendChild(listElement);
    });

    resultsTable.insertAdjacentElement("beforeend", list);

    if (results.length > maxResults && !all) {
        var btn = document.createElement("button");
        btn.innerHTML = "Show all";

        btn.addEventListener("click", function () {
            var entryResults = indices[key].search({
                query: searchQuery,
            });

            populateSmallResults(entryResults, searchQuery, key, indices, true);
        });
        
        resultsTable.insertAdjacentElement("beforeend", btn);
    }

    new Mark(resultsTable).mark(searchQuery);
}

function populateFindFactsResults(searchTerm, data) {
    var resultsElement = document.getElementById("find-facts-results");
    if (Object.keys(data).length !== 0 && resultsElement) {
        let urlPrefix =
            'https://search.isabelle.in.tum.de/#search/default_Isabelle2021_AFP2021?q={"term":"';
        urlPrefix += searchTerm + '","facets":{"Kind":["';
        const urlSuffix = '"]}}';

        var list = document.createElement("ul");

        Object.entries(data).forEach(([name, count]) => {
            var listElement = document.createElement("li");
            var anchor = document.createElement("a");
            anchor.href = urlPrefix + name + urlSuffix;
            anchor.target = "_blank";
            anchor.rel = "noreferrer noopener";
            anchor.innerHTML = count + " " + name + "s";
            listElement.appendChild(anchor);
            list.appendChild(listElement);
        });

        setInnerHTMLOfID("find-facts-results", "");
        resultsElement.insertAdjacentElement("beforeend", list);
    } else {
        setInnerHTMLOfID("find-facts-results", "No results");
    }
}

function handleSubmit(value) {
    if (typeof history.pushState !== "undefined") {
        history.pushState({}, "Search the Archive - " + value, "?s=" + value);
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
    }
}

function setInnerHTMLOfID(id, str) {
    const elem = document.getElementById(id);
    if (elem) {
        elem.innerHTML = str;
    } else {
        console.log("Failed to find:", id, "for innerHTML");
    }
}

document.addEventListener("DOMContentLoaded", function () {
    var input = document.getElementById("searchInput");
    var urlQuery = param("s");
    if (urlQuery) {
        input.value = urlQuery;
    }
    input.focus();

    document.getElementById("searchButton").addEventListener("click", () => {
        handleSubmit(document.getElementById("searchInput").value);
    });

    Promise.all([
        fetch("/index.json"),
        fetch("/authors/index.json"),
        fetch("/topics/index.json"),
        fetch("/data/keywords.json"),
    ])
        .then(function (responses) {
            // Get a JSON object from each of the responses
            return Promise.all(responses.map((response) => response.json()));
        })
        .then((data) => loadSearch(...data));

    function param(name) {
        return decodeURIComponent(
            (location.search.split(name + "=")[1] || "").split("&")[0]
        ).replace(/\+/g, " ");
    }
});
