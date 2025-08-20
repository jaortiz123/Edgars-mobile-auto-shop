"""Backend package init.

Expose submodules expected by tests. Some tests patch objects via
``mocker.patch("backend.local_server.db_conn", ...)``. In certain execution
orders the `local_server` module may first be imported as a top-level module
(`local_server`) which (because of aliasing logic inside that file) registers
`backend.local_server` in ``sys.modules`` but does *not* automatically attach
it as an attribute on the ``backend`` package object. Python only sets the
attribute when the import machinery loads the submodule under the package
namespace directly.

To guarantee the attribute is present for patch lookups we import it here.
This is lightweight (module already initialized if previously loaded) and
idempotent.
"""

from . import local_server as local_server  # noqa: F401
