"""Static extraction of the parameter paths a dispatcher template reads.

Walks the Jinja2 AST: chains of names, subscripts and attributes rooted at a template
variable give a dotted path; a `for` loop binds its variable to "<list path>.[]"; included
templates are followed; macro bodies (they read their own arguments) and `loop` are left
out. A path counts as guarded when the template reads it through the `default` filter or
tests it with `is defined`.
"""

from jinja2 import nodes


class TemplatePaths:
    def __init__(self, environment):
        self.environment = environment

    def read(self, template_name):
        """Returns (paths read, guarded paths) of a template, snippets included."""
        read, guarded = set(), set()
        self._walk(self._parse(template_name), {}, read, guarded)
        return read, guarded

    def _parse(self, template_name):
        source = self.environment.loader.get_source(self.environment, template_name)[0]
        return self.environment.parse(source)

    def _chain(self, node, scope):
        parts = []
        while True:
            if isinstance(node, nodes.Getitem):
                arg = node.arg
                parts.append(arg.value if isinstance(arg, nodes.Const) and isinstance(arg.value, str) else "[]")
                node = node.node
            elif isinstance(node, nodes.Getattr):
                parts.append(node.attr)
                node = node.node
            elif isinstance(node, nodes.Name):
                if node.ctx != "load":
                    return None
                base = scope.get(node.name, [node.name])
                if base is None:
                    return None
                return ".".join(base + list(reversed(parts)))
            else:
                return None

    def _walk(self, node, scope, read, guarded):
        if isinstance(node, nodes.Macro):
            return
        if isinstance(node, nodes.Import):
            scope[node.target] = None
            return
        if isinstance(node, nodes.Include):
            self._walk(self._parse(node.template.value), dict(scope), read, guarded)
            return
        if isinstance(node, nodes.For):
            iterated = self._chain(node.iter, scope)
            if iterated is None:
                self._walk(node.iter, scope, read, guarded)
            else:
                read.add(iterated)
            inner = dict(scope)
            targets = [node.target] if isinstance(node.target, nodes.Name) else list(node.target.items)
            for target in targets:
                inner[target.name] = None if iterated is None else iterated.split(".") + ["[]"]
            inner["loop"] = None
            for child in node.body + node.else_:
                self._walk(child, inner, read, guarded)
            return
        if isinstance(node, (nodes.Filter, nodes.Test)) and node.name in ("default", "defined"):
            path = self._chain(node.node, scope)
            if path is not None:
                guarded.add(path)
        if isinstance(node, (nodes.Getitem, nodes.Getattr, nodes.Name)):
            path = self._chain(node, scope)
            if path is not None:
                read.add(path)
                inner = node
                while isinstance(inner, (nodes.Getitem, nodes.Getattr)):
                    if isinstance(inner, nodes.Getitem) and not isinstance(inner.arg, nodes.Const):
                        self._walk(inner.arg, scope, read, guarded)
                    inner = inner.node
                return
        for child in node.iter_child_nodes():
            self._walk(child, scope, read, guarded)
