# Historical compatibility entrypoint. The v16.3.1 renderer supersedes the v16.3.0
# always-visible dense-grid assertions with zoom-adaptive shared-corridor checks.
from test_route_grid_v1631 import main
if __name__ == '__main__':
    main()
