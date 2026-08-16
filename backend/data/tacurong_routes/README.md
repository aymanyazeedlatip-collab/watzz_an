# Tacurong Route Planning Data

`tacurong_route_history_2016_2025.csv` is a normalized parse of the supplied SUKELCO Tacurong City History Ledger text files. It retains route number, route name, consumer entries, total kWh used and billed amount by ledger year.

The frontend planning asset derives route forecasts through 2034 from these records. The supplied ledger has no GIS line coordinates; route overlays therefore use a real OpenStreetMap basemap with clearly labeled approximate route coverage corridors.

`consumer_entries` should not be interpreted as unique annual households. WATTZAN displays kWh / consumer entries as a consumer-month / household-equivalent planning estimate.
