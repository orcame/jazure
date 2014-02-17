$(function () {
    Date.prototype.format = function (fmt) {
        var o = {
            "M+": this.getMonth() + 1,
            "d+": this.getDate(),
            "h+": this.getHours() % 12 == 0 ? 12 : this.getHours() % 12,
            "H+": this.getHours(),
            "m+": this.getMinutes(),
            "s+": this.getSeconds(),
            "q+": Math.floor((this.getMonth() + 3) / 3),
            "S": this.getMilliseconds()
        };
        var week = {
            "0": "\u65e5",
            "1": "\u4e00",
            "2": "\u4e8c",
            "3": "\u4e09",
            "4": "\u56db",
            "5": "\u4e94",
            "6": "\u516d"
        };
        if (/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        }
        if (/(E+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "\u661f\u671f" : "\u5468") : "") + week[this.getDay() + ""]);
        }
        for (var k in o) {
            if (new RegExp("(" + k + ")").test(fmt)) {
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            }
        }
        return fmt;
    };

    function readableSize(value) {
        var units = ["B", "KB", "MB", "GB", "TB", "PB"];
        if (typeof (value) == 'string') {
            value = parseInt(value);
        }
        for (var idx = 0; idx < units.length; idx++) {
            if (value < 1024) {
                return value.toFixed(2) + units[idx];
            }
            value = value / 1024;
        }
    };

    function readableDate(value) {
        var date = new Date(value);
        if (isNaN(date.getDate())) {
            return 'N/A';
        }
        return date.format('MM/dd/yyyy HH:mm:ss');
    };

    function extensionName(value) {
        if (!value) {
            return '';
        }
        return value.substr(value.lastIndexOf('.'));
    };
    var je = {
        accountName: null,
        sharedKey: null,
        containerName: null,
        endpoint: 'core.chinacloudapi.cn',
        sas: null,
        panel: $('#content'),
        menu: $('#menu'),
        container: null,
        init: function () {
            if (this.accountName && this.sharedKey && this.containerName) {
                var account = ja.storage.account(this.accountName, this.sharedKey, this.endpoint);
                this.container = account.getContainer(this.containerName);
            } else if (this.sas) {
                this.container = ja.container(sas);
            }
        },
        settings: function () {

        },
        createBox: function (item) {
            var box = $('<div/>');
            box.append(item.Name);
            return box;
        },
        showBoxes: function (list) {

        },
        listBlobs: function () {
            this.container.listBlobs(function (blobs) {
                $('<div/>').load('views/blobList.html', function (html) {
                    var table = je.render(html, {
                        blobs: blobs,
                        datePasser: readableDate,
                        sizePasser: readableSize,
                        extension: extensionName
                    });
                    je.panel.empty().html(table);
                })
            });
        },
        render: function (html, content) {
            var re = /<!--(.+?)-->/g, reExp = /(^( )?(if|for|else|switch|case|break|var|{|}))(.*)?/g, code = 'var r=[];\n', cursor = 0;
            if (content) {
                for (var n in content) {
                    code += 'var ' + n + '= this["' + n + '"];\n';
                }
            }
            var add = function (line, js) {
                js ? (code += line.match(reExp) ? line + '\n' : 'r.push(' + line + ');\n') :
                    (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
                return add;
            }
            while (match = re.exec(html)) {
                add(html.slice(cursor, match.index))(match[1], true);
                cursor = match.index + match[0].length;
            }
            add(html.substr(cursor, html.length - cursor));
            code += 'return r.join("");';
            return new Function('', code.replace(/[\r\t\n]/g, '')).apply(content);
        }
    }
    window.je = je;
    je.accountName = 'neeostorage';
    je.sharedKey = 'byJtu9UFb3siM7KJneXw86XelJfYsDfp/3nmLAB+SJK7uxGy5N8qecbd0/UWzdRjCHYsBxQB1y3J9iFhN4lxYQ==';
    je.containerName = 'read-write';
    je.init();
    je.listBlobs();
})