var $conTextMenu = "";
// an noop function define
var _noop = function () {};
var $deep = 0;

(function ($w) {
  "use strict";
  // set 'jsMind' as the library name.
  // __name__ should be a const value, Never try to change it easily.
  var __name__ = "jsMind";
  // library version
  var __version__ = "0.4.6";

  var logger =
    typeof console === "undefined"
      ? {
          log: _noop,
          debug: _noop,
          error: _noop,
          warn: _noop,
          info: _noop,
        }
      : console;

  if (!logger.debug) logger.debug = _noop;

  // check global variables
  if (typeof module === "undefined" || !module.exports) {
    if (typeof $w[__name__] != "undefined") {
      logger.log(__name__ + " has been already exist.");
      return;
    }
  }

  // shortcut of methods in dom
  var $d = $w.document;
  var $g = function (id) {
    return $d.getElementById(id);
  };
  var $c = function (tag) {
    return $d.createElement(tag);
  };
  var $t = function (n, t) {
    if (n.hasChildNodes()) {
      n.firstChild.nodeValue = t;
    } else {
      n.appendChild($d.createTextNode(t));
    }
  };
  var $h = function (n, t) {
    //@todo 展示 topic 内容
    n.innerHTML = t.replace(/\n/g, "<br/>");
  };
  // detect isElement
  var $i = function (el) {
    return (
      !!el &&
      typeof el === "object" &&
      el.nodeType === 1 &&
      typeof el.style === "object" &&
      typeof el.ownerDocument === "object"
    );
  };
  if (typeof String.prototype.startsWith != "function") {
    String.prototype.startsWith = function (p) {
      return this.slice(0, p.length) === p;
    };
  }

  var DEFAULT_OPTIONS = {
    container: "", // id of the container
    theme: null,
    mode: "full", // full or side
    support_html: true,

    view: {
      hmargin: 100,
      vmargin: 50,
      line_width: 2,
      line_color: "#555",
    },
    layout: {
      hspace: 100, // @todo 调整框的间距
      vspace: 50,
      pspace: 13,
    },
    shortcut: {
      enable: true,
      handles: {},
      mapping: {
        addchild: 45, // Insert
        addbrother: 13, // Enter
        delnode: 46, // Delete
        toggle: 32, // Space
        left: 37, // Left
        up: 38, // Up
        right: 39, // Right
        down: 40, // Down
      },
    },
  };

  // core object
  var jm = function (options) {
    jm.current = this;

    this.version = __version__;
    var opts = {};
    jm.util.json.merge(opts, DEFAULT_OPTIONS);
    jm.util.json.merge(opts, options);

    if (!opts.container) {
      logger.error("the options.container should not be null or empty.");
      return;
    }
    this.options = opts;
    this.inited = false;
    this.mind = null;
    this.event_handles = [];
    this.init();
  };

  // ============= static object =============================================
  jm.direction = { left: -1, center: 0, right: 1 };
  jm.event_type = { show: 1, resize: 2, select: 4 };

  jm.node = function (
    sId,
    iIndex,
    sTopic,
    oData,
    bIsRoot,
    oParent,
    eDirection,
    bExpanded
  ) {
    if (!sId) {
      logger.error("invalid nodeid");
      return;
    }
    if (typeof iIndex != "number") {
      logger.error("invalid node index");
      return;
    }
    if (typeof bExpanded === "undefined") {
      bExpanded = true;
    }
    this.id = sId;
    this.index = iIndex;
    this.topic = sTopic;
    this.data = oData || {};
    this.isroot = bIsRoot;
    this.parent = oParent;
    this.direction = eDirection;
    this.expanded = !!bExpanded;
    this.children = [];
    this._data = {};
  };

  jm.node.compare = function (node1, node2) {
    // '-1' is alwary the last
    var r = 0;
    var i1 = node1.index;
    var i2 = node2.index;
    if (i1 >= 0 && i2 >= 0) {
      r = i1 - i2;
    } else if (i1 == -1 && i2 == -1) {
      r = 0;
    } else if (i1 == -1) {
      r = 1;
    } else if (i2 == -1) {
      r = -1;
    } else {
      r = 0;
    }
    //logger.debug(i1+' <> '+i2+'  =  '+r);
    return r;
  };

  jm.node.inherited = function (pnode, node) {
    if (!!pnode && !!node) {
      if (pnode.id === node.id) {
        return true;
      }
      if (pnode.isroot) {
        return true;
      }
      var pid = pnode.id;
      var p = node;
      while (!p.isroot) {
        p = p.parent;
        if (p.id === pid) {
          return true;
        }
      }
    }
    return false;
  };

  jm.node.prototype = {
    get_location: function () {
      var vd = this._data.view;
      return {
        x: vd.abs_x,
        y: vd.abs_y,
      };
    },
    get_size: function () {
      var vd = this._data.view;
      return {
        w: vd.width,
        h: vd.height,
      };
    },
  };

  jm.mind = function () {
    this.name = null;
    this.author = null;
    this.version = null;
    this.root = null;
    this.selected = null;
    this.nodes = {};
  };

  jm.mind.prototype = {
    get_node: function (nodeid) {
      if (nodeid in this.nodes) {
        return this.nodes[nodeid];
      } else {
        logger.warn("the node[id=" + nodeid + "] can not be found");
        return null;
      }
    },

    set_root: function (nodeid, topic, data) {
      if (this.root == null) {
        this.root = new jm.node(nodeid, 0, topic, data, true);
        this._put_node(this.root);
      } else {
        logger.error("root node is already exist");
      }
    },

    add_node: function (
      parent_node,
      nodeid,
      topic,
      data,
      idx,
      direction,
      expanded
    ) {
      if (!jm.util.is_node(parent_node)) {
        var the_parent_node = this.get_node(parent_node);
        if (!the_parent_node) {
          logger.error(
            "the parent_node[id=" + parent_node + "] can not be found."
          );
          return null;
        } else {
          return this.add_node(
            the_parent_node,
            nodeid,
            topic,
            data,
            idx,
            direction,
            expanded
          );
        }
      }
      var nodeindex = idx || -1;
      var node = null;
      if (parent_node.isroot) {
        var d = jm.direction.right;
        if (!direction || isNaN(direction)) {
          var children = parent_node.children;
          var children_len = children.length;
          var r = 0;
          for (var i = 0; i < children_len; i++) {
            if (children[i].direction === jm.direction.left) {
              r--;
            } else {
              r++;
            }
          }
          d =
            children_len > 1 && r > 0 ? jm.direction.left : jm.direction.right;
        } else {
          d =
            direction != jm.direction.left
              ? jm.direction.right
              : jm.direction.left;
        }
        node = new jm.node(
          nodeid,
          nodeindex,
          topic,
          data,
          false,
          parent_node,
          d,
          expanded
        );
      } else {
        node = new jm.node(
          nodeid,
          nodeindex,
          topic,
          data,
          false,
          parent_node,
          parent_node.direction,
          expanded
        );
      }
      if (this._put_node(node)) {
        parent_node.children.push(node);
        this._reindex(parent_node);
      } else {
        logger.error(
          "fail, the nodeid '" + node.id + "' has been already exist."
        );
        node = null;
      }
      return node;
    },

    insert_node_before: function (node_before, nodeid, topic, data) {
      if (!jm.util.is_node(node_before)) {
        var the_node_before = this.get_node(node_before);
        if (!the_node_before) {
          logger.error(
            "the node_before[id=" + node_before + "] can not be found."
          );
          return null;
        } else {
          return this.insert_node_before(the_node_before, nodeid, topic, data);
        }
      }
      var node_index = node_before.index - 0.5;
      return this.add_node(node_before.parent, nodeid, topic, data, node_index);
    },

    get_node_before: function (node) {
      if (!jm.util.is_node(node)) {
        var the_node = this.get_node(node);
        if (!the_node) {
          logger.error("the node[id=" + node + "] can not be found.");
          return null;
        } else {
          return this.get_node_before(the_node);
        }
      }
      if (node.isroot) {
        return null;
      }
      var idx = node.index - 2;
      if (idx >= 0) {
        return node.parent.children[idx];
      } else {
        return null;
      }
    },

    insert_node_after: function (node_after, nodeid, topic, data) {
      if (!jm.util.is_node(node_after)) {
        var the_node_after = this.get_node(node_before);
        if (!the_node_after) {
          logger.error(
            "the node_after[id=" + node_after + "] can not be found."
          );
          return null;
        } else {
          return this.insert_node_after(the_node_after, nodeid, topic, data);
        }
      }
      var node_index = node_after.index + 0.5;
      return this.add_node(node_after.parent, nodeid, topic, data, node_index);
    },

    get_node_after: function (node) {
      if (!jm.util.is_node(node)) {
        var the_node = this.get_node(node);
        if (!the_node) {
          logger.error("the node[id=" + node + "] can not be found.");
          return null;
        } else {
          return this.get_node_after(the_node);
        }
      }
      if (node.isroot) {
        return null;
      }
      var idx = node.index;
      var brothers = node.parent.children;
      if (brothers.length >= idx) {
        return node.parent.children[idx];
      } else {
        return null;
      }
    },

    move_node: function (node, beforeid, parentid, direction) {
      if (!jm.util.is_node(node)) {
        var the_node = this.get_node(node);
        if (!the_node) {
          logger.error("the node[id=" + node + "] can not be found.");
          return null;
        } else {
          return this.move_node(the_node, beforeid, parentid, direction);
        }
      }
      if (!parentid) {
        parentid = node.parent.id;
      }
      return this._move_node(node, beforeid, parentid, direction);
    },

    _flow_node_direction: function (node, direction) {
      if (typeof direction === "undefined") {
        direction = node.direction;
      } else {
        node.direction = direction;
      }
      var len = node.children.length;
      while (len--) {
        this._flow_node_direction(node.children[len], direction);
      }
    },

    _move_node_internal: function (node, beforeid) {
      if (!!node && !!beforeid) {
        if (beforeid == "_last_") {
          node.index = -1;
          this._reindex(node.parent);
        } else if (beforeid == "_first_") {
          node.index = 0;
          this._reindex(node.parent);
        } else {
          var node_before = !!beforeid ? this.get_node(beforeid) : null;
          if (
            node_before != null &&
            node_before.parent != null &&
            node_before.parent.id == node.parent.id
          ) {
            node.index = node_before.index - 0.5;
            this._reindex(node.parent);
          }
        }
      }
      return node;
    },

    _move_node: function (node, beforeid, parentid, direction) {
      if (!!node && !!parentid) {
        if (node.parent.id != parentid) {
          // remove from parent's children
          var sibling = node.parent.children;
          var si = sibling.length;
          while (si--) {
            if (sibling[si].id == node.id) {
              sibling.splice(si, 1);
              break;
            }
          }
          node.parent = this.get_node(parentid);
          node.parent.children.push(node);
        }

        if (node.parent.isroot) {
          if (direction == jsMind.direction.left) {
            node.direction = direction;
          } else {
            node.direction = jm.direction.right;
          }
        } else {
          node.direction = node.parent.direction;
        }
        this._move_node_internal(node, beforeid);
        this._flow_node_direction(node);
      }
      return node;
    },

    _put_node: function (node) {
      if (node.id in this.nodes) {
        logger.warn("the nodeid '" + node.id + "' has been already exist.");
        return false;
      } else {
        this.nodes[node.id] = node;
        return true;
      }
    },

    _reindex: function (node) {
      if (node instanceof jm.node) {
        node.children.sort(jm.node.compare);
        for (var i = 0; i < node.children.length; i++) {
          node.children[i].index = i + 1;
        }
      }
    },
  };

  jm.format = {
    node_tree: {
      get_mind: function (source) {
        var df = jm.format.node_tree;
        var mind = new jm.mind();
        mind.name = source.meta.name;
        mind.author = source.meta.author;
        mind.version = source.meta.version;
        df._parse(mind, source.data);
        return mind;
      },
      get_data: function (mind) {
        var df = jm.format.node_tree;
        var json = {};
        json.meta = {
          name: mind.name,
          author: mind.author,
          version: mind.version,
        };
        json.format = "node_tree";
        json.data = df._buildnode(mind.root);
        return json;
      },

      _parse: function (mind, node_root) {
        var df = jm.format.node_tree;
        var data = df._extract_data(node_root);
        mind.set_root(node_root.id, node_root.topic, data);
        if ("children" in node_root) {
          var children = node_root.children;
          for (var i = 0; i < children.length; i++) {
            df._extract_subnode(mind, mind.root, children[i]);
          }
        }
      },

      _extract_data: function (node_json) {
        var data = {};
        for (var k in node_json) {
          if (
            k == "id" ||
            k == "topic" ||
            k == "children" ||
            k == "direction" ||
            k == "expanded"
          ) {
            continue;
          }
          data[k] = node_json[k];
        }
        return data;
      },

      _extract_subnode: function (mind, node_parent, node_json) {
        var df = jm.format.node_tree;
        var data = df._extract_data(node_json);
        var d = null;
        if (node_parent.isroot) {
          d =
            node_json.direction == "left"
              ? jm.direction.left
              : jm.direction.right;
        }
        var node = mind.add_node(
          node_parent,
          node_json.id,
          node_json.topic,
          data,
          null,
          d,
          node_json.expanded
        );
        if ("children" in node_json) {
          var children = node_json.children;
          for (var i = 0; i < children.length; i++) {
            df._extract_subnode(mind, node, children[i]);
          }
        }
      },

      _buildnode: function (node) {
        var df = jm.format.node_tree;
        if (!(node instanceof jm.node)) {
          return;
        }
        var o = {
          id: node.id,
          topic: node.topic,
          expanded: node.expanded,
        };
        if (!!node.parent && node.parent.isroot) {
          o.direction = node.direction == jm.direction.left ? "left" : "right";
        }
        if (node.data != null) {
          var node_data = node.data;
          for (var k in node_data) {
            o[k] = node_data[k];
          }
        }
        var children = node.children;
        if (children.length > 0) {
          o.children = [];
          for (var i = 0; i < children.length; i++) {
            o.children.push(df._buildnode(children[i]));
          }
        }
        return o;
      },
    },

    node_array: {
      get_mind: function (source) {
        var df = jm.format.node_array;
        var mind = new jm.mind();
        mind.name = source.meta.name;
        mind.author = source.meta.author;
        mind.version = source.meta.version;
        df._parse(mind, source.data);
        return mind;
      },

      _parse: function (mind, node_array) {
        var df = jm.format.node_array;
        var narray = node_array.slice(0);
        // reverse array for improving looping performance
        narray.reverse();
        var root_id = df._extract_root(mind, narray);
        if (!!root_id) {
          df._extract_subnode(mind, root_id, narray);
        } else {
          logger.error("root node can not be found");
        }
      },

      _extract_root: function (mind, node_array) {
        var df = jm.format.node_array;
        var i = node_array.length;
        while (i--) {
          if ("isroot" in node_array[i] && node_array[i].isroot) {
            var root_json = node_array[i];
            var data = df._extract_data(root_json);
            mind.set_root(root_json.id, root_json.topic, data);
            node_array.splice(i, 1);
            return root_json.id;
          }
        }
        return null;
      },

      _extract_subnode: function (mind, parentid, node_array) {
        var df = jm.format.node_array;
        var i = node_array.length;
        var node_json = null;
        var data = null;
        var extract_count = 0;
        while (i--) {
          node_json = node_array[i];
          if (node_json.parentid == parentid) {
            data = df._extract_data(node_json);
            var d = null;
            var node_direction = node_json.direction;
            if (!!node_direction) {
              d =
                node_direction == "left"
                  ? jm.direction.left
                  : jm.direction.right;
            }
            mind.add_node(
              parentid,
              node_json.id,
              node_json.topic,
              data,
              null,
              d,
              node_json.expanded
            );
            node_array.splice(i, 1);
            extract_count++;
            var sub_extract_count = df._extract_subnode(
              mind,
              node_json.id,
              node_array
            );
            if (sub_extract_count > 0) {
              // reset loop index after extract subordinate node
              i = node_array.length;
              extract_count += sub_extract_count;
            }
          }
        }
        return extract_count;
      },

      _extract_data: function (node_json) {
        var data = {};
        for (var k in node_json) {
          if (
            k == "id" ||
            k == "topic" ||
            k == "parentid" ||
            k == "isroot" ||
            k == "direction" ||
            k == "expanded"
          ) {
            continue;
          }
          data[k] = node_json[k];
        }
        return data;
      },
    },

    freemind: {
      get_mind: function (source) {
        var df = jm.format.freemind;
        var mind = new jm.mind();
        mind.name = source.meta.name;
        mind.author = source.meta.author;
        mind.version = source.meta.version;
        var xml = source.data;
        var xml_doc = df._parse_xml(xml);
        var xml_root = df._find_root(xml_doc);
        df._load_node(mind, null, xml_root);
        return mind;
      },

      get_data: function (mind) {
        var df = jm.format.freemind;
        var json = {};
        json.meta = {
          name: mind.name,
          author: mind.author,
          version: mind.version,
        };
        json.format = "freemind";
        var xmllines = [];
        xmllines.push('<map version="1.0.1">');
        df._buildmap(mind.root, xmllines);
        xmllines.push("</map>");
        json.data = xmllines.join(" ");
        return json;
      },

      _parse_xml: function (xml) {
        var xml_doc = null;
        if (window.DOMParser) {
          var parser = new DOMParser();
          xml_doc = parser.parseFromString(xml, "text/xml");
        } else {
          // Internet Explorer
          xml_doc = new ActiveXObject("Microsoft.XMLDOM");
          xml_doc.async = false;
          xml_doc.loadXML(xml);
        }
        return xml_doc;
      },

      _find_root: function (xml_doc) {
        var nodes = xml_doc.childNodes;
        var node = null;
        var root = null;
        var n = null;
        for (var i = 0; i < nodes.length; i++) {
          n = nodes[i];
          if (n.nodeType == 1 && n.tagName == "map") {
            node = n;
            break;
          }
        }
        if (!!node) {
          var ns = node.childNodes;
          node = null;
          for (var i = 0; i < ns.length; i++) {
            n = ns[i];
            if (n.nodeType == 1 && n.tagName == "node") {
              node = n;
              break;
            }
          }
        }
        return node;
      },

      _load_node: function (mind, parent_id, xml_node) {
        var df = jm.format.freemind;
        var node_id = xml_node.getAttribute("ID");
        var node_topic = xml_node.getAttribute("TEXT");
        // look for richcontent
        if (node_topic == null) {
          var topic_children = xml_node.childNodes;
          var topic_child = null;
          for (var i = 0; i < topic_children.length; i++) {
            topic_child = topic_children[i];
            //logger.debug(topic_child.tagName);
            if (
              topic_child.nodeType == 1 &&
              topic_child.tagName === "richcontent"
            ) {
              node_topic = topic_child.textContent;
              break;
            }
          }
        }
        var node_data = df._load_attributes(xml_node);
        var node_expanded =
          "expanded" in node_data ? node_data.expanded == "true" : true;
        delete node_data.expanded;

        var node_position = xml_node.getAttribute("POSITION");
        var node_direction = null;
        if (!!node_position) {
          node_direction =
            node_position == "left" ? jm.direction.left : jm.direction.right;
        }
        //logger.debug(node_position +':'+ node_direction);
        if (!!parent_id) {
          mind.add_node(
            parent_id,
            node_id,
            node_topic,
            node_data,
            null,
            node_direction,
            node_expanded
          );
        } else {
          mind.set_root(node_id, node_topic, node_data);
        }
        var children = xml_node.childNodes;
        var child = null;
        for (var i = 0; i < children.length; i++) {
          child = children[i];
          if (child.nodeType == 1 && child.tagName == "node") {
            df._load_node(mind, node_id, child);
          }
        }
      },

      _load_attributes: function (xml_node) {
        var children = xml_node.childNodes;
        var attr = null;
        var attr_data = {};
        for (var i = 0; i < children.length; i++) {
          attr = children[i];
          if (attr.nodeType == 1 && attr.tagName === "attribute") {
            attr_data[attr.getAttribute("NAME")] = attr.getAttribute("VALUE");
          }
        }
        return attr_data;
      },

      _buildmap: function (node, xmllines) {
        var df = jm.format.freemind;
        var pos = null;
        if (!!node.parent && node.parent.isroot) {
          pos = node.direction === jm.direction.left ? "left" : "right";
        }
        xmllines.push("<node");
        xmllines.push('ID="' + node.id + '"');
        if (!!pos) {
          xmllines.push('POSITION="' + pos + '"');
        }
        xmllines.push('TEXT="' + node.topic + '">');

        // store expanded status as an attribute
        xmllines.push(
          '<attribute NAME="expanded" VALUE="' + node.expanded + '"/>'
        );

        // for attributes
        var node_data = node.data;
        if (node_data != null) {
          for (var k in node_data) {
            xmllines.push(
              '<attribute NAME="' + k + '" VALUE="' + node_data[k] + '"/>'
            );
          }
        }

        // for children
        var children = node.children;
        for (var i = 0; i < children.length; i++) {
          df._buildmap(children[i], xmllines);
        }

        xmllines.push("</node>");
      },
    },
  };

  // ============= utility object =============================================

  jm.util = {
    is_node: function (node) {
      return !!node && node instanceof jm.node;
    },
    ajax: {
      _xhr: function () {
        var xhr = null;
        if (window.XMLHttpRequest) {
          xhr = new XMLHttpRequest();
        } else {
          try {
            xhr = new ActiveXObject("Microsoft.XMLHTTP");
          } catch (e) {}
        }
        return xhr;
      },
      _eurl: function (url) {
        return encodeURIComponent(url);
      },
      request: function (url, param, method, callback, fail_callback) {
        var a = jm.util.ajax;
        var p = null;
        var tmp_param = [];
        for (var k in param) {
          tmp_param.push(a._eurl(k) + "=" + a._eurl(param[k]));
        }
        if (tmp_param.length > 0) {
          p = tmp_param.join("&");
        }
        var xhr = a._xhr();
        if (!xhr) {
          return;
        }
        xhr.onreadystatechange = function () {
          if (xhr.readyState == 4) {
            if (xhr.status == 200 || xhr.status == 0) {
              if (typeof callback === "function") {
                var data = jm.util.json.string2json(xhr.responseText);
                if (data != null) {
                  callback(data);
                } else {
                  callback(xhr.responseText);
                }
              }
            } else {
              if (typeof fail_callback === "function") {
                fail_callback(xhr);
              } else {
                logger.error("xhr request failed.", xhr);
              }
            }
          }
        };
        method = method || "GET";
        xhr.open(method, url, true);
        xhr.setRequestHeader("If-Modified-Since", "0");
        if (method == "POST") {
          xhr.setRequestHeader(
            "Content-Type",
            "application/x-www-form-urlencoded;charset=utf-8"
          );
          xhr.send(p);
        } else {
          xhr.send();
        }
      },
      get: function (url, callback) {
        return jm.util.ajax.request(url, {}, "GET", callback);
      },
      post: function (url, param, callback) {
        return jm.util.ajax.request(url, param, "POST", callback);
      },
    },

    canvas: {
      bezierto: function (ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo(x1 + ((x2 - x1) * 2) / 3, y1, x1, y2, x2, y2);
        ctx.stroke();
      },
      lineto: function (ctx, x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      },
    },

    json: {
      json2string: function (json) {
        if (!!JSON) {
          try {
            var json_str = JSON.stringify(json);
            return json_str;
          } catch (e) {
            logger.warn(e);
            logger.warn("can not convert to string");
            return null;
          }
        }
      },
      string2json: function (json_str) {
        if (!!JSON) {
          try {
            var json = JSON.parse(json_str);
            return json;
          } catch (e) {
            logger.warn(e);
            logger.warn("can not parse to json");
            return null;
          }
        }
      },
      merge: function (b, a) {
        for (var o in a) {
          if (o in b) {
            if (
              typeof b[o] === "object" &&
              Object.prototype.toString.call(b[o]).toLowerCase() ==
                "[object object]" &&
              !b[o].length
            ) {
              jm.util.json.merge(b[o], a[o]);
            } else {
              b[o] = a[o];
            }
          } else {
            b[o] = a[o];
          }
        }
        return b;
      },
    },

    uuid: {
      newid: function () {
        return (
          new Date().getTime().toString(16) +
          Math.random().toString(16).substr(2)
        ).substr(2, 16);
      },
    },

    text: {
      is_empty: function (s) {
        if (!s) {
          return true;
        }
        return s.replace(/\s*/, "").length == 0;
      },
    },
  };

  jm.prototype = {
    init: function () {
      if (this.inited) {
        return;
      }
      this.inited = true;

      var opts = this.options;

      var opts_layout = {
        mode: opts.mode,
        hspace: opts.layout.hspace,
        vspace: opts.layout.vspace,
        pspace: opts.layout.pspace,
      };
      var opts_view = {
        container: opts.container,
        support_html: opts.support_html,
        hmargin: opts.view.hmargin,
        vmargin: opts.view.vmargin,
        line_width: opts.view.line_width,
        line_color: opts.view.line_color,
      };
      // create instance of function provider
      this.data = new jm.data_provider(this);
      this.layout = new jm.layout_provider(this, opts_layout);
      this.view = new jm.view_provider(this, opts_view);
      this.shortcut = new jm.shortcut_provider(this, opts.shortcut);

      this.data.init();
      this.layout.init();
      this.view.init();
      this.shortcut.init();
      jm.init_plugins(this);
    },

    _reset: function () {
      this.view.reset();
      this.layout.reset();
      this.data.reset();
    },

    _show: function (mind) {
      var m = mind;
      this.mind = this.data.load(m);
      if (!this.mind) {
        logger.error("data.load error");
        return;
      } else {
        logger.debug("data.load ok");
      }

      this.view.load();
      logger.debug("view.load ok");

      this.layout.layout();
      logger.debug("layout.layout ok");

      this.view.show(true);
      logger.debug("view.show ok");
    },

    show: function (mind) {
      this._reset();
      this._show(mind);
    },
  };

  // ============= data provider =============================================

  jm.data_provider = function (jm) {
    this.jm = jm;
  };

  jm.data_provider.prototype = {
    init: function () {
      logger.debug("data.init");
    },

    reset: function () {
      logger.debug("data.reset");
    },

    load: function (mind_data) {
      var df = null;
      var mind = null;
      if (typeof mind_data === "object") {
        if (!!mind_data.format) {
          df = mind_data.format;
        } else {
          df = "node_tree";
        }
      } else {
        df = "freemind";
      }

      if (df == "node_array") {
        mind = jm.format.node_array.get_mind(mind_data);
      } else if (df == "node_tree") {
        mind = jm.format.node_tree.get_mind(mind_data);
      } else if (df == "freemind") {
        mind = jm.format.freemind.get_mind(mind_data);
      } else {
        logger.warn("unsupported format");
      }
      return mind;
    },

    get_data: function (data_format) {
      var data = null;
      if (data_format == "node_array") {
        data = jm.format.node_array.get_data(this.jm.mind);
      } else if (data_format == "node_tree") {
        data = jm.format.node_tree.get_data(this.jm.mind);
      } else if (data_format == "freemind") {
        data = jm.format.freemind.get_data(this.jm.mind);
      } else {
        logger.error("unsupported " + data_format + " format");
      }
      return data;
    },
  };

  // ============= layout provider ===========================================

  jm.layout_provider = function (jm, options) {
    this.opts = options;
    this.jm = jm;
    this.isside = this.opts.mode == "side";
    this.bounds = null;

    this.cache_valid = false;
  };

  jm.layout_provider.prototype = {
    init: function () {
      logger.debug("layout.init");
    },
    reset: function () {
      logger.debug("layout.reset");
      this.bounds = { n: 0, s: 0, w: 0, e: 0 };
    },
    layout: function () {
      logger.debug("layout.layout");
      this.layout_direction();
      this.layout_offset();
    },

    layout_direction: function () {
      this._layout_direction_root();
    },

    _layout_direction_root: function () {
      var node = this.jm.mind.root;
      // logger.debug(node);
      var layout_data = null;
      if ("layout" in node._data) {
        layout_data = node._data.layout;
      } else {
        layout_data = {};
        node._data.layout = layout_data;
      }
      var children = node.children;
      var children_count = children.length;
      layout_data.direction = jm.direction.center;
      layout_data.side_index = 0;
      if (this.isside) {
        var i = children_count;
        while (i--) {
          this._layout_direction_side(children[i], jm.direction.right, i);
        }
      } else {
        var i = children_count;
        var subnode = null;
        while (i--) {
          subnode = children[i];
          this._layout_direction_side(subnode, jm.direction.right, i);
        }
      }
    },

    _layout_direction_side: function (node, direction, side_index) {
      var layout_data = null;
      if ("layout" in node._data) {
        layout_data = node._data.layout;
      } else {
        layout_data = {};
        node._data.layout = layout_data;
      }
      var children = node.children;
      var children_count = children.length;

      layout_data.direction = direction;
      layout_data.side_index = side_index;
      var i = children_count;
      while (i--) {
        this._layout_direction_side(children[i], direction, i);
      }
    },

    layout_offset: function () {
      var node = this.jm.mind.root;
      var layout_data = node._data.layout;
      layout_data.offset_x = 0;
      layout_data.offset_y = 0;
      layout_data.outer_height = 0;
      var children = node.children;
      var i = children.length;
      var left_nodes = [];
      var right_nodes = [];
      var subnode = null;
      while (i--) {
        subnode = children[i];
        if (subnode._data.layout.direction == jm.direction.right) {
          right_nodes.unshift(subnode);
        } else {
          left_nodes.unshift(subnode);
        }
      }
      layout_data.left_nodes = left_nodes;
      layout_data.right_nodes = right_nodes;
      layout_data.outer_height_left = this._layout_offset_subnodes(left_nodes);
      layout_data.outer_height_right = this._layout_offset_subnodes(
        right_nodes
      );
      this.bounds.e = node._data.view.width / 2;
      this.bounds.w = 0 - this.bounds.e;
      //logger.debug(this.bounds.w);
      this.bounds.n = 0;
      this.bounds.s = Math.max(
        layout_data.outer_height_left,
        layout_data.outer_height_right
      );
    },

    // layout both the x and y axis
    _layout_offset_subnodes: function (nodes) {
      var total_height = 0;
      var nodes_count = nodes.length;
      var i = nodes_count;
      var node = null;
      var node_outer_height = 0;
      var layout_data = null;
      var base_y = 0;
      var pd = null; // parent._data
      while (i--) {
        node = nodes[i];
        layout_data = node._data.layout;
        if (pd == null) {
          pd = node.parent._data;
        }

        node_outer_height = this._layout_offset_subnodes(node.children);
        if (!node.expanded) {
          node_outer_height = 0;
          this.set_visible(node.children, false);
        }
        node_outer_height = Math.max(node._data.view.height, node_outer_height);

        layout_data.outer_height = node_outer_height;
        layout_data.offset_y = base_y - node_outer_height / 2;
        layout_data.offset_x =
          this.opts.hspace * layout_data.direction +
          (pd.view.width * (pd.layout.direction + layout_data.direction)) / 2;
        if (!node.parent.isroot) {
          layout_data.offset_x += this.opts.pspace * layout_data.direction;
        }

        base_y = base_y - node_outer_height - this.opts.vspace;
        total_height += node_outer_height;
      }
      if (nodes_count > 1) {
        total_height += this.opts.vspace * (nodes_count - 1);
      }
      i = nodes_count;
      var middle_height = total_height / 2;
      while (i--) {
        node = nodes[i];
        node._data.layout.offset_y += middle_height;
      }
      return total_height;
    },

    // layout the y axis only, for collapse/expand a node
    _layout_offset_subnodes_height: function (nodes) {
      var total_height = 0;
      var nodes_count = nodes.length;
      var i = nodes_count;
      var node = null;
      var node_outer_height = 0;
      var layout_data = null;
      var base_y = 0;
      var pd = null; // parent._data
      while (i--) {
        node = nodes[i];
        layout_data = node._data.layout;
        if (pd == null) {
          pd = node.parent._data;
        }

        node_outer_height = this._layout_offset_subnodes_height(node.children);
        if (!node.expanded) {
          node_outer_height = 0;
        }
        node_outer_height = Math.max(node._data.view.height, node_outer_height);

        layout_data.outer_height = node_outer_height;
        layout_data.offset_y = base_y - node_outer_height / 2;
        base_y = base_y - node_outer_height - this.opts.vspace;
        total_height += node_outer_height;
      }
      if (nodes_count > 1) {
        total_height += this.opts.vspace * (nodes_count - 1);
      }
      i = nodes_count;
      var middle_height = total_height / 2;
      while (i--) {
        node = nodes[i];
        node._data.layout.offset_y += middle_height;
        //logger.debug(node.topic);
        //logger.debug(node._data.layout.offset_y);
      }
      return total_height;
    },

    get_node_offset: function (node) {
      var layout_data = node._data.layout;
      var offset_cache = null;
      if ("_offset_" in layout_data && this.cache_valid) {
        offset_cache = layout_data._offset_;
      } else {
        offset_cache = { x: -1, y: -1 };
        layout_data._offset_ = offset_cache;
      }
      if (offset_cache.x == -1 || offset_cache.y == -1) {
        var x = layout_data.offset_x;
        var y = layout_data.offset_y;
        if (!node.isroot) {
          var offset_p = this.get_node_offset(node.parent);
          x += offset_p.x;
          y += offset_p.y;
        }
        offset_cache.x = x;
        offset_cache.y = y;
      }
      return offset_cache;
    },

    get_node_point: function (node) {
      var view_data = node._data.view;
      var offset_p = this.get_node_offset(node);
      //logger.debug(offset_p);
      var p = {};
      p.x =
        offset_p.x + (view_data.width * (node._data.layout.direction - 1)) / 2;
      p.y = offset_p.y - view_data.height / 2;
      //logger.debug(p);
      return p;
    },

    get_node_point_in: function (node) {
      var p = this.get_node_offset(node);
      return p;
    },

    get_node_point_out: function (node) {
      var layout_data = node._data.layout;
      var pout_cache = null;
      if ("_pout_" in layout_data && this.cache_valid) {
        pout_cache = layout_data._pout_;
      } else {
        pout_cache = { x: -1, y: -1 };
        layout_data._pout_ = pout_cache;
      }
      if (pout_cache.x == -1 || pout_cache.y == -1) {
        if (node.isroot) {
          pout_cache.x = 0;
          pout_cache.y = 0;
        } else {
          var view_data = node._data.view;
          var offset_p = this.get_node_offset(node);
          pout_cache.x =
            offset_p.x +
            (view_data.width + this.opts.pspace) * node._data.layout.direction;
          pout_cache.y = offset_p.y;
          //logger.debug('pout');
          //logger.debug(pout_cache);
        }
      }
      return pout_cache;
    },

    get_expander_point: function (node) {
      var p = this.get_node_point_out(node);
      var ex_p = {};
      if (node._data.layout.direction == jm.direction.right) {
        ex_p.x = p.x - this.opts.pspace;
      } else {
        ex_p.x = p.x;
      }
      ex_p.y = p.y - Math.ceil(this.opts.pspace / 2);
      return ex_p;
    },

    get_min_size: function () {
      var nodes = this.jm.mind.nodes;
      var node = null;
      var pout = null;
      for (var nodeid in nodes) {
        node = nodes[nodeid];
        if (node.parent && !node.parent.expanded) {
          continue;
        }
        pout = this.get_node_point_out(node);
        //logger.debug(pout.x);
        if (pout.x > this.bounds.e) {
          this.bounds.e = pout.x;
        }
        if (pout.x < this.bounds.w) {
          this.bounds.w = pout.x;
        }
      }
      return {
        w: this.bounds.e - this.bounds.w,
        h: this.bounds.s - this.bounds.n,
      };
    },

    is_visible: function (node) {
      var layout_data = node._data.layout;
      if ("visible" in layout_data && !layout_data.visible) {
        return false;
      } else {
        return true;
      }
    },
  };

  // view provider
  jm.view_provider = function (jm, options) {
    this.opts = options;
    this.jm = jm;
    this.layout = jm.layout;

    this.container = null;
    this.e_panel = null;
    this.e_nodes = null;
    this.e_canvas = null;

    this.canvas_ctx = null;
    this.size = { w: 0, h: 0 };

    this.selected_node = null;
  };

  jm.view_provider.prototype = {
    init: function () {
      logger.debug("view.init");

      this.container = $i(this.opts.container)
        ? this.opts.container
        : $g(this.opts.container);
      if (!this.container) {
        logger.error("the options.view.container was not be found in dom");
        return;
      }
      this.e_panel = $c("div");
      this.e_canvas = $c("canvas");
      this.e_nodes = $c("jmnodes");

      this.e_panel.className = "jsmind-inner";
      this.e_panel.appendChild(this.e_canvas);
      this.e_panel.appendChild(this.e_nodes);

      var v = this;

      this.container.appendChild(this.e_panel);

      this.init_canvas();
    },
    get_binded_nodeid: function (element) {
      if (element == null) {
        return null;
      }
      var tagName = element.tagName.toLowerCase();
      if (tagName == "jmnodes" || tagName == "body" || tagName == "html") {
        return null;
      }
      if (tagName == "jmnode" || tagName == "jmexpander") {
        return element.getAttribute("nodeid");
      } else {
        return this.get_binded_nodeid(element.parentElement);
      }
    },

    is_expander: function (element) {
      return element.tagName.toLowerCase() == "jmexpander";
    },

    reset: function () {
      logger.debug("view.reset");
      this.selected_node = null;
      this.reset_theme();
    },

    reset_theme: function () {
      var theme_name = this.jm.options.theme;
      if (!!theme_name) {
        this.e_nodes.className = "theme-" + theme_name;
      } else {
        this.e_nodes.className = "";
      }
    },

    reset_custom_style: function () {
      var nodes = this.jm.mind.nodes;
      for (var nodeid in nodes) {
        this.reset_node_custom_style(nodes[nodeid]);
      }
    },

    load: function () {
      logger.debug("view.load");
      this.init_nodes();
    },

    expand_size: function () {
      var min_size = this.layout.get_min_size();
      var min_width = min_size.w + this.opts.hmargin * 2;
      var min_height = min_size.h + this.opts.vmargin * 2;
      var client_w = this.e_panel.clientWidth;
      var client_h = this.e_panel.clientHeight;
      if (client_w < min_width) {
        client_w = min_width;
      }
      if (client_h < min_height) {
        client_h = min_height;
      }
      this.size.w = client_w;
      this.size.h = client_h;
    },

    init_canvas: function () {
      var ctx = this.e_canvas.getContext("2d");
      this.canvas_ctx = ctx;
    },

    init_nodes_size: function (node) {
      var view_data = node._data.view;
      view_data.width = view_data.element.clientWidth;
      view_data.height = view_data.element.clientHeight;
    },

    init_nodes: function () {
      var nodes = this.jm.mind.nodes;
      var doc_frag = $d.createDocumentFragment();
      for (var nodeid in nodes) {
        this.create_node_element(nodes[nodeid], doc_frag);
      }
      this.e_nodes.appendChild(doc_frag);
      for (var nodeid in nodes) {
        this.init_nodes_size(nodes[nodeid]);
      }
    },

    add_node: function (node) {
      this.create_node_element(node, this.e_nodes);
      this.init_nodes_size(node);
    },

    create_node_element: function (node, parent_node) {
      var view_data = null;
      if ("view" in node._data) {
        view_data = node._data.view;
      } else {
        view_data = {};
        node._data.view = view_data;
      }
      var backgroundColorList = {
        1: "#E2F0FF",
        2: "#D9F7E9",
        3: "#FFF5DD",
        4: "#F7EAFF",
        0: "#FFEFEF",
      };
      var { subNum, line } = node.data;
      if ($deep < subNum) {
        $deep = subNum;
      }
      var d = $c("jmnode");
      if (line) {
        d.style.backgroundColor = backgroundColorList[line % 5];
      }
      // d.style.backgroundColor='red'
      if (node.isroot) {
        d.className = "root";
      } else {
        d.classList.add("line-num" + subNum);
        d.classList.add("group-num" + line);
        var d_e = $c("jmexpander"); // 右侧的小东西
        $t(d_e, "-");
        d_e.setAttribute("nodeid", node.id);
        d_e.style.visibility = "hidden";
        parent_node.appendChild(d_e);
        view_data.expander = d_e;
      }
      if (!!node.topic) {
        if (this.opts.support_html) {
          $h(d, node.topic);
        } else {
          $t(d, node.topic);
        }
      }

      // 创建右上角的小图标 雕漆里
      var badge = $c("div");
      badge.className = "alan-badge";
      parent_node.appendChild(badge);
      $t(badge, node._data.badge);
      badge.setAttribute("nodeid", node.id);
      badge.style.visibility = "hidden";
      view_data.badge = badge;

      d.setAttribute("nodeid", node.id);
      d.style.visibility = "hidden";

      this._reset_node_custom_style(d, node.data);

      parent_node.appendChild(d);
      view_data.element = d;
    },

    get_view_offset: function () {
      var bounds = this.layout.bounds;
      var _x = (this.size.w - bounds.e - bounds.w) / 2;
      var _y = this.size.h / 2;
      return { x: _x, y: _y };
    },

    _show: function () {
      this.e_canvas.width = this.size.w;
      this.e_canvas.height = this.size.h;
      this.e_nodes.style.width = this.size.w + "px";
      this.e_nodes.style.height = this.size.h + "px";
      this.show_nodes();
      this.show_lines();
    },

    _center_root: function () {
      // center root node
      var outer_w = this.e_panel.clientWidth;
      var outer_h = this.e_panel.clientHeight;
      if (this.size.w > outer_w) {
        var _offset = this.get_view_offset();
        this.e_panel.scrollLeft = _offset.x - outer_w / 2;
      }
      if (this.size.h > outer_h) {
        this.e_panel.scrollTop = (this.size.h - outer_h) / 2;
      }
    },

    show: function (keep_center) {
      logger.debug("view.show");
      this.expand_size();
      this._show();
      if (!!keep_center) {
        this._center_root();
      }
    },

    show_nodes: function () {
      var nodes = this.jm.mind.nodes;
      var node = null;
      var node_element = null;
      var expander = null;
      var p = null;
      var p_expander = null;
      var view_data = null;
      var _offset = this.get_view_offset();
      for (var nodeid in nodes) {
        node = nodes[nodeid];
        view_data = node._data.view;
        node_element = view_data.element;
        expander = view_data.expander;
        if (!this.layout.is_visible(node)) {
          node_element.style.display = "none";
          expander.style.display = "none";
          continue;
        }
        this.reset_node_custom_style(node);
        p = this.layout.get_node_point(node);
        view_data.abs_x = _offset.x + p.x;
        view_data.abs_y = _offset.y + p.y;
        node_element.style.left = _offset.x + p.x + 8 + "px";
        node_element.style.top = _offset.y + p.y + "px";
        node_element.style.display = "";
        node_element.style.visibility = "visible";

        p_expander = this.layout.get_expander_point(node);
        // 当下面已经没有children时，隐藏expander收缩按钮
        if (!node.isroot && node.children.length == 0) {
          expander.style.display = "none";
          expander.style.visibility = "hidden";
        }
      }
    },

    reset_node_custom_style: function (node) {
      this._reset_node_custom_style(node._data.view.element, node.data);
    },

    _reset_node_custom_style: function (node_element, node_data) {
      if ("background-color" in node_data) {
        node_element.style.backgroundColor = node_data["background-color"];
      }
      if ("foreground-color" in node_data) {
        node_element.style.color = node_data["foreground-color"];
      }
      if ("width" in node_data) {
        node_element.style.width = node_data["width"] + "px";
      }
      if ("height" in node_data) {
        node_element.style.height = node_data["height"] + "px";
      }
      if ("font-size" in node_data) {
        node_element.style.fontSize = node_data["font-size"] + "px";
      }
      if ("font-weight" in node_data) {
        node_element.style.fontWeight = node_data["font-weight"];
      }
      if ("font-style" in node_data) {
        node_element.style.fontStyle = node_data["font-style"];
      }
      if ("background-image" in node_data) {
        var backgroundImage = node_data["background-image"];
        if (
          backgroundImage.startsWith("data") &&
          node_data["width"] &&
          node_data["height"]
        ) {
          var img = new Image();

          img.onload = function () {
            var c = $c("canvas");
            c.width = node_element.clientWidth;
            c.height = node_element.clientHeight;
            var img = this;
            if (c.getContext) {
              var ctx = c.getContext("2d");
              ctx.drawImage(
                img,
                2,
                2,
                node_element.clientWidth,
                node_element.clientHeight
              );
              var scaledImageData = c.toDataURL();
              node_element.style.backgroundImage =
                "url(" + scaledImageData + ")";
            }
          };
          img.src = backgroundImage;
        } else {
          node_element.style.backgroundImage = "url(" + backgroundImage + ")";
        }
        node_element.style.backgroundSize = "99%";

        if ("background-rotation" in node_data) {
          node_element.style.transform =
            "rotate(" + node_data["background-rotation"] + "deg)";
        }
      }
    },

    show_lines: function (canvas_ctx) {
      var nodes = this.jm.mind.nodes;
      var node = null;
      var pin = null;
      var pout = null;
      var _offset = this.get_view_offset();
      for (var nodeid in nodes) {
        // debugger
        node = nodes[nodeid];
        if (!!node.isroot) {
          continue;
        }
        var lineNum = node.parent.isroot ? 0 : node.data.line;
        if ("visible" in node._data.layout && !node._data.layout.visible) {
          continue;
        }
        pin = this.layout.get_node_point_in(node);
        pout = this.layout.get_node_point_out(node.parent);
        this.draw_line(pout, pin, _offset, canvas_ctx, lineNum);
      }
    },

    draw_line: function (pin, pout, offset, canvas_ctx, line) {
      var ctx = canvas_ctx || this.canvas_ctx;
      // @todo 控制线条颜色
      // ctx.strokeStyle = this.opts.line_color;
      var lineColorList = {
        1: "#057AFF",
        2: "#14CC76",
        3: "#FF8B3D",
        4: "#BC72EA",
        0: "#FE3131",
      };
      if (line) {
        ctx.strokeStyle = lineColorList[line % 5];
      } else {
        ctx.strokeStyle = "#057AFF";
      }
      ctx.lineWidth = this.opts.line_width;
      ctx.lineCap = "round";

      jm.util.canvas.bezierto(
        ctx,
        pin.x + offset.x,
        pin.y + offset.y,
        pout.x + offset.x,
        pout.y + offset.y
      );
    },
  };

  // shortcut provider
  jm.shortcut_provider = function (jm, options) {
    this.jm = jm;
    this.opts = options;
    this.mapping = options.mapping;
    this.handles = options.handles;
    this._mapping = {};
  };

  jm.shortcut_provider.prototype = {
    init: function () {
      this.handles["addchild"] = this.handle_addchild;
      this.handles["addbrother"] = this.handle_addbrother;
      this.handles["delnode"] = this.handle_delnode;
      this.handles["toggle"] = this.handle_toggle;
      this.handles["up"] = this.handle_up;
      this.handles["down"] = this.handle_down;
      this.handles["left"] = this.handle_left;
      this.handles["right"] = this.handle_right;

      for (var handle in this.mapping) {
        if (!!this.mapping[handle] && handle in this.handles) {
          this._mapping[this.mapping[handle]] = this.handles[handle];
        }
      }
    },

    enable_shortcut: function () {
      this.opts.enable = true;
    },

    disable_shortcut: function () {
      this.opts.enable = false;
    },

    handler: function (e) {
      var evt = e || event;
      if (!this.opts.enable) {
        return true;
      }
      var kc = evt.keyCode;
      if (kc in this._mapping) {
        this._mapping[kc].call(this, this.jm, e);
      }
    },

    handle_left: function (_jm, e) {
      this._handle_direction(_jm, e, jm.direction.left);
    },
    handle_right: function (_jm, e) {
      this._handle_direction(_jm, e, jm.direction.right);
    },
    _handle_direction: function (_jm, e, d) {
      var evt = e || event;
      var selected_node = _jm.get_selected_node();
      var node = null;
      if (!!selected_node) {
        if (selected_node.isroot) {
          var c = selected_node.children;
          var children = [];
          for (var i = 0; i < c.length; i++) {
            if (c[i].direction === d) {
              children.push(i);
            }
          }
          node = c[children[Math.floor((children.length - 1) / 2)]];
        } else if (selected_node.direction === d) {
          var children = selected_node.children;
          var childrencount = children.length;
          if (childrencount > 0) {
            node = children[Math.floor((childrencount - 1) / 2)];
          }
        } else {
          node = selected_node.parent;
        }
        if (!!node) {
          _jm.select_node(node);
        }
        evt.stopPropagation();
        evt.preventDefault();
      }
    },
  };

  // plugin
  jm.plugin = function (name, init) {
    this.name = name;
    this.init = init;
  };

  jm.plugins = [];

  jm.register_plugin = function (plugin) {
    if (plugin instanceof jm.plugin) {
      jm.plugins.push(plugin);
    }
  };

  jm.init_plugins = function (sender) {
    $w.setTimeout(function () {
      jm._init_plugins(sender);
    }, 0);
  };

  jm._init_plugins = function (sender) {
    var l = jm.plugins.length;
    var fn_init = null;
    for (var i = 0; i < l; i++) {
      fn_init = jm.plugins[i].init;
      if (typeof fn_init === "function") {
        fn_init(sender);
      }
    }
  };

  // quick way
  jm.show = function (options, mind) {
    var _jm = new jm(options);
    _jm.show(mind);
    return _jm;
  };

  $w[__name__] = jm;
})(window);
/*
 * Released under BSD License
 * Copyright (c) 2014-2015 hizzgdev@163.com
 *
 * Project Home:
 *   https://github.com/hizzgdev/jsmind/
 */

(function ($w) {
  "use strict";

  var __name__ = "jsMind";
  var jsMind = $w[__name__];
  if (!jsMind) {
    return;
  }
  if (typeof jsMind.screenshot != "undefined") {
    return;
  }

  var $d = $w.document;
  var $c = function (tag) {
    return $d.createElement(tag);
  };

  var css = function (cstyle, property_name) {
    return cstyle.getPropertyValue(property_name);
  };
  var is_visible = function (cstyle) {
    var visibility = css(cstyle, "visibility");
    var display = css(cstyle, "display");
    return visibility !== "hidden" && display !== "none";
  };
  var jcanvas = jsMind.util.canvas;
  jcanvas.rect = function (ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
  };

  jcanvas.text_multiline = function (ctx, text, x, y, w, h, lineheight) {
    var colorfulText =
      text.match(/<.*>(.*)<.*>/) && text.match(/<.*>(.*)<.*>/)[1];
    var formatText = text.replace(/<.*>(.*)<.*>/, "$1");
    var line = "";
    var text_len = formatText.length;
    var chars = formatText.split("");
    var test_line = null;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (var i = 0; i < text_len; i++) {
      test_line = line + chars[i];
      // @todo 当文案出现\n，换行展示
      if (
        (ctx.measureText(test_line).width > w || chars[i] === "\n") &&
        i > 0
      ) {
        if (colorfulText && line.includes(colorfulText)) {
          var normalText = line.replace(colorfulText, "");
          var colorfulTextX = x + ctx.measureText(normalText).width;
          ctx.fillText(normalText, x, y);
          ctx.fillText(colorfulText, colorfulTextX, y);
          ctx.fillStyle = "red";
        } else {
          ctx.fillText(line, x, y);
        }
        line = chars[i] === "\n" ? "" : chars[i];
        y += lineheight;
      } else {
        line = test_line;
      }
    }
    if (colorfulText && line.includes(colorfulText)) {
      var normalText = line.replace(colorfulText, "");
      var colorfulTextX = x + ctx.measureText(normalText).width;
      ctx.fillText(normalText, x, y);
      // 标出突出的字体颜色
      ctx.fillStyle = "#ff6e0d";
      ctx.fillText(colorfulText, colorfulTextX, y);
    } else {
      ctx.fillText(line, x, y);
    }
  };

  jsMind.screenshot = function (jm) {
    this.jm = jm;
    this.canvas_elem = null;
    this.canvas_ctx = null;
    this._inited = false;
  };

  jsMind.screenshot.prototype = {
    init: function () {
      if (this._inited) {
        return;
      }
      var c = $c("canvas");
      var ctx = c.getContext("2d");

      this.canvas_elem = c;
      this.canvas_ctx = ctx;
      this.jm.view.e_panel.appendChild(c);
      this._inited = true;
      this.resize();
    },

    shoot: function (callback) {
      this.init();
      var jms = this;
      this._draw(function () {
        if (!!callback) {
          callback(jms);
        }
      });
    },

    shootAsDataURL: function (callback) {
      this.shoot(function (jms) {
        callback(jms.canvas_elem.toDataURL());
      });
    },

    resize: function () {
      if (this._inited) {
        this.canvas_elem.width = this.jm.view.size.w;
        this.canvas_elem.height = this.jm.view.size.h;
      }
    },

    _draw: function (callback) {
      var ctx = this.canvas_ctx;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      this._draw_lines();
      this._draw_nodes(callback);
    },

    _draw_lines: function () {
      this.jm.view.show_lines(this.canvas_ctx);
    },

    _draw_nodes: function (callback) {
      var nodes = this.jm.mind.nodes;
      var node;
      for (var nodeid in nodes) {
        node = nodes[nodeid];
        this._draw_node(node);
      }

      function check_nodes_ready() {
        var allOk = true;
        for (var nodeid in nodes) {
          node = nodes[nodeid];
          allOk = allOk & node.ready;
        }

        if (!allOk) {
          $w.setTimeout(check_nodes_ready, 200);
        } else {
          $w.setTimeout(callback, 200);
        }
      }
      check_nodes_ready();
    },

    _draw_node: function (node) {
      var ctx = this.canvas_ctx;
      var view_data = node._data.view;
      var node_element = view_data.element;
      var ncs = getComputedStyle(node_element);
      if (!is_visible(ncs)) {
        node.ready = true;
        return;
      }
      var bgcolor = '';
      if ($deep !== +node.data.subNum) {
        bgcolor = css(ncs, "background-color")
      } else {
        bgcolor = '#fff'
      }
      var round_radius = parseInt(css(ncs, "border-top-left-radius"));
      var color = css(ncs, "color");
      var padding_left = parseInt(css(ncs, "padding-left"));
      var padding_right = parseInt(css(ncs, "padding-right"));
      var padding_top = parseInt(css(ncs, "padding-top"));
      var padding_bottom = parseInt(css(ncs, "padding-bottom"));
      var text_overflow = css(ncs, "text-overflow");
      var font =
        css(ncs, "font-style") +
        " " +
        css(ncs, "font-variant") +
        " " +
        css(ncs, "font-weight") +
        " " +
        css(ncs, "font-size") +
        "/" +
        css(ncs, "line-height") +
        " " +
        css(ncs, "font-family");

      var rb = {
        x: view_data.abs_x,
        y: view_data.abs_y,
        w: view_data.width + 1,
        h: view_data.height + 1,
      };
      var tb = {
        x: rb.x + padding_left,
        y: rb.y + padding_top,
        w: rb.w - padding_left - padding_right,
        h: rb.h - padding_top - padding_bottom,
      };

      ctx.font = font;
      ctx.fillStyle = bgcolor;
      ctx.beginPath();
      jcanvas.rect(ctx, rb.x, rb.y, rb.w, rb.h, round_radius);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = color;
      if ("background-image" in node.data) {
        var backgroundUrl = css(ncs, "background-image").slice(5, -2);
        node.ready = false;
        var rotation = 0;
        if ("background-rotation" in node.data) {
          rotation = node.data["background-rotation"];
        }
        jcanvas.image(
          ctx,
          backgroundUrl,
          rb.x,
          rb.y,
          rb.w,
          rb.h,
          round_radius,
          rotation,
          function () {
            node.ready = true;
          }
        );
      }
      // @todo 画文案
      if (!!node.topic) {
        if (text_overflow === "ellipsis") {
          jcanvas.text_ellipsis(ctx, node.topic, tb.x, tb.y, tb.w, tb.h);
        } else {
          var line_height = parseInt(css(ncs, "line-height"));
          jcanvas.text_multiline(
            ctx,
            node.topic,
            tb.x,
            tb.y,
            tb.w,
            tb.h,
            line_height
          );
        }
      }
      if (!!view_data.expander) {
        this._draw_expander(view_data.expander);
      }
      if (!("background-image" in node.data)) {
        node.ready = true;
      }
    },

    _draw_expander: function (expander) {
      var ctx = this.canvas_ctx;
      var ncs = getComputedStyle(expander);
      if (!is_visible(ncs)) {
        return;
      }

      var style_left = css(ncs, "left");
      var style_top = css(ncs, "top");
      var font = css(ncs, "font");
      var left = parseInt(style_left);
      var top = parseInt(style_top);
      var is_plus = expander.innerHTML === "+";

      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.arc(left + 7, top + 7, 5, 0, Math.PI * 2, true);
      ctx.moveTo(left + 10, top + 7);
      ctx.lineTo(left + 4, top + 7);
      if (is_plus) {
        ctx.moveTo(left + 7, top + 4);
        ctx.lineTo(left + 7, top + 10);
      }
      ctx.closePath();
      ctx.stroke();
    },
  };

  var screenshot_plugin = new jsMind.plugin("screenshot", function (jm) {
    var jss = new jsMind.screenshot(jm);
    jm.screenshot = jss;
    jm.shoot = function () {
      jss.shoot();
    };
  });

  jsMind.register_plugin(screenshot_plugin);
})(window);

// kmsjsmap
(function ($w) {
  if (!$w.jsMind) return;

  var __NAME__ = "kmsjsmap";
  var logger =
    typeof console === "undefined"
      ? {
          log: _noop,
          debug: _noop,
          error: _noop,
          warn: _noop,
          info: _noop,
        }
      : console;
  if (!logger.debug) logger.debug = _noop;

  if (typeof module === "undefined" || !module.exports) {
    if (typeof $w[__NAME__] !== "undefined") {
      logger.log(__NAME__ + "已经存在啦啦啦啦~");
      return;
    }
  }

  var kmsjsmap = {
    options: "",
    isInit: false,
    onRelation: _noop,
  };

  kmsjsmap.init = function (options) {
    // console.log('init:', options)
    if (!options || Object.keys(options).length === 0) {
      logger.warn("请对" + __NAME__ + ".init()传入必要的参数");
      return;
    }
    if (this.isInit) return;
    this.isInit = true;
    this.options = options;
    if (options.onRelation) this.onRelation = options.onRelation;
    this._load_jsmind();
  };

  var _jm = null;

  // 初始化思维导图
  kmsjsmap._load_jsmind = function () {
    var options = {
      container: this.options.container,
      theme: "kms1",
      mode: "full",
      shortcut: {
        enable: false, // 是否启用快捷键
      },
      onRelation: this.onRelation,
      view: {
        line_width: 2,
        line_color: "gray", // @todo - 线条
      },
    };
    var mind = {
      meta: {
        name: "xmind",
        author: "Alan",
        version: "1.0",
      },
      format: "node_array",
      data: this.options.data,
    };
    _jm = new jsMind(options);
    _jm.show(mind);
  };

  kmsjsmap.shootAsDataURL = function (callback) {
    _jm.screenshot.shootAsDataURL(callback);
  };

  $w[__NAME__] = kmsjsmap;
})(window);
