# Project Goals

## Vision
Create an automated application that scrapes Wikipedia every 24 hours to collect detailed statistics for the UK series of *The Traitors*. The goal is to maintain an up-to-date, comprehensive CSV dataset capturing episode-by-episode and series-by-series performance.

I also want to have an endpoint I can call as a 'one off' so I can be more adhoc in my triggering of the functionality.

It must look at all series (current series 1 to 4) and scrape information about:

* Episode-by-episode voting patterns, who voted for who etc
* Character profiles, including things like gender, name, ideally images etc
* As much information as is possible 

## Key Performance Indicators
- **Reliability**: Successful scraping and CSV generation every 24 hours.
- **Accuracy**: 100% data fidelity compared to Wikipedia source tables.
- **Completeness**: Includes all UK series and all broadcast episodes.
- **Data Quality**: Consistent CSV structure with clear headers and no malformed entries.

## Milestones
- [ ] Initialize project and identify Wikipedia source URLs for UK *The Traitors*.
- [ ] Develop robust scraping logic for series and episode tables.
- [ ] Implement data processing to aggregate episode-by-episode statistics.
- [ ] Automate the execution loop (24-hour schedule).
- [ ] Verify CSV generation and storage.
