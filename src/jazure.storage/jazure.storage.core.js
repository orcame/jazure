(function (jAzure, $, global) {
    var ja = jAzure
        , maxBlockSize = 4096 * 1024;
    //storage
    var storage = {
        newLineChar: '\n',
        x_ms_version: '2013-08-15',
        blockSize: maxBlockSize,
        serviceEndpoint: 'core.windows.net'
    };

    jAzure.storage = storage;

    //get absolute path from url
    function getAbsolutePath(uri) {
        var reg = new RegExp('http[s]?://[^/]*/([^?]*)');
        var match = reg.exec(uri);
        return match && match[1].length > 0 ? match[1] : '/';
    }
    //get the query strings on url
    function getQueryStrings(uri) {
        var reg = new RegExp('([^&?=]+)=([^=&]*)', 'g'), qs = [];
        var match = reg.exec(uri);
        while (match) {
            qs.push({ name: match[1], value: match[2] });
            match = reg.exec(uri);
        }
        return qs;
    }
    function getCanonicalizedHeaderString(headers) {
        var canonicalizedHeaders = [];
        for (var n in headers) {
            if (n.indexOf('x-ms-') == 0) {
                canonicalizedHeaders.push({
                    name: n.toLowerCase(), value: headers[n].trim(), toString: function () {
                        return this.name + ':' + this.value.trim().replace(/\r\n/g, '');
                    }
                });
            }
        }
        canonicalizedHeaders.sort(function (a, b) {
            return a.name > b.name ? 1 : -1;
        })
        return canonicalizedHeaders.join(storage.newLineChar);
    }
    function getCanonicalizedResourceString(uri, accountName, isSharedKeyLiteOrTableService) {
        var resources = ['/', accountName];
        var absolutePath = getAbsolutePath(uri);
        absolutePath = absolutePath.replace(accountName + '-secondary', accountName);
        if (absolutePath) {
            if (absolutePath != '/') {
                resources.push('/');
            }
            resources.push(encodeURI(absolutePath));
        }
        var queryStrings = getQueryStrings(uri);
        if (!isSharedKeyLiteOrTableService) {
            queryStrings.sort(function (a, b) {
                return a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1;
            })
            var len = queryStrings.length;
            for (var i = 0; i < len; i++) {
                var qs = queryStrings[i];
                resources.push(storage.newLineChar);
                resources.push(qs.name.toLowerCase());
                resources.push(':');
                resources.push(encodeURI(qs.value));
            }
        } else {
            var len = queryStrings.length;
            if (len > 0) {
                resources.push(storage.newLineChar);
            }
            for (var i = 0; i < len; i++) {
                if (queryStrings[i].name == 'comp') {
                    resources.push('?comp=');
                    resources.push(queryStrings[i].value);
                }
            }
        }
        return resources.join('');
    }
    function getSharedKeyAuthHeader(request, accountName, sharedKey) {
        var hs = request.isSharedKeyLiteOrTableService ?
             ['Content-MD5', 'Content-Type', 'Date'] :
             ['Content-Encoding', 'Content-Language', 'Content-Length', 'Content-MD5', 'Content-Type', 'Date', 'If-Modified-Since', 'If-Match', 'If-None-Match', 'If-Unmodified-Since', 'Range'];
        var auts = [request.type]
            , len = hs.length;
        for (var idx = 0; idx < len; idx++) {
            var h = request.headers[hs[idx]];
            auts.push(h != undefined ? h : '');
        }
        if (!request.isSharedKeyLiteOrTableService && request.type == 'PUT' || request.type == 'DELETE' || request.type == 'HEAD') {
            auts[3] = request.data ? request.data.length : 0;
        }
        auts.push(getCanonicalizedHeaderString(request.headers));
        auts.push(getCanonicalizedResourceString(request.url, accountName, request.isSharedKeyLiteOrTableService));
        var message = CryptoJS.enc.Utf8.parse(auts.join(storage.newLineChar));
        var key = CryptoJS.enc.Base64.parse(sharedKey);
        var hash = CryptoJS.HmacSHA256(message, key);
        var signature = hash.toString(CryptoJS.enc.Base64)
        var str = accountName + ':' + signature;
        if (request.isSharedKeyLiteOrTableService) {
            return 'SharedKeyLite ' + str;
        } else {
            return 'SharedKey ' + str;
        }
    }
    var rnoContent = /^(?:GET|HEAD)$/, rquery = /\?/;
    function cacheUrl(request) {
        var hasContent = !rnoContent.test(request.type), cacheURL = request.url;
        if (!hasContent && request.data) {
            cacheURL += (rquery.test(cacheURL) ? "&" : "?") + request.data;
        }
        return cacheURL;
    }
    function canonicalizeRequestHeaders(request) {
        request.headers = request.headers || {};
        var curl = cacheUrl(request);
        if (request.ifModified) {
            if ($.lastModified[curl]) {
                request.headers["If-Modified-Since"] = $.lastModified[curl];
            }
            if ($.etag[curl]) {
                request.headers['If-None-Match'] = $.etag[curl];
            }
        }
        request.headers['x-ms-version'] = storage.x_ms_version;
        request.headers['x-ms-date'] = new Date().toGMTString();
        if (request.headers['Content-Type']) {
            request.contentType = request.headers['Content-Type'];
        }
    }
    function canonicalizeRequest(request, auth) {
        canonicalizeRequestHeaders(request);
        if (auth) {
            request.headers['Authorization'] = getSharedKeyAuthHeader(request, auth.accountName, auth.sharedKey);
        }
    }
    function preSetUrl(request) {
        var url = request.url;
        if (request.params) {
            var p = [];
            for (var n in request.params) {
                p.push(n + '=' + request.params[n]);
            }
            if (url.indexOf('?') > 0) {
                url += '&' + p.join('&');
            } else {
                url += '?' + p.join('&');
            }
            request.url = url;
        }
    }
    var web = function (accountName, sharedKey) {
        return new web.prototype.init(accountName, sharedKey);
    };

    web.prototype = {
        init: function (accountName, sharedKey) {

            var _auth = accountName && sharedKey
                ? { accountName: accountName, sharedKey: sharedKey }
                : null;
            this.sendRequest = function (request) {
                request.url = request.url;
                preSetUrl(request);
                request.ifModified = true;
                canonicalizeRequest(request, _auth);
                ja.ajax(request);
            }
        }, request: function (url, verb, params, options) {
            return new request(this, url, verb, params, options);
        }
    };
    web.prototype.init.prototype = web.prototype;

    function request(web, url, verb, params, options) {
        if (options) {
            $.extend(this, options);
        }
        this.web = web;
        this.type = verb;
        this.url = url;
        this.params = params;
    }
    request.prototype = {
        send: function (success, error) {
            if (success) {
                this.success = success;
            }
            if (error) {
                this.error = error;
            }
            this.web.sendRequest(this);
        }
    };
    jAzure.storage.web = web;
})(jAzure, jQuery, window);

