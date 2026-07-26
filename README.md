# Republic of Noobistan Dashboard v1.1

GitHub Pages-ready Chess.com sidebar dashboard.

## Music

Place an MP3 at:

`assets/music/Audio.mp3`

You can replace that file whenever you want without changing the HTML. The existing hosted track remains as a fallback if the local file is missing.

## Included links

All community and event buttons open the supplied Republic of Noobistan Chess.com pages. The copyright logo opens And Chess For All Official.

## GitHub Pages

Upload the complete folder to a public GitHub repository, then enable Pages from the main branch and root folder.

## Chess.com embed

```html
<div style="width:100%;max-width:700px;margin:0 auto;">
  <iframe
    src="YOUR-GITHUB-PAGES-URL"
    width="100%"
    height="1200"
    frameborder="0"
    scrolling="yes"
    title="Republic of Noobistan Dashboard"
    style="display:block;border:0;border-radius:18px;overflow:hidden;background:#020713;">
  </iframe>
</div>
```


## New member board

The Members page loads the six newest club members from the Chess.com Public API using the club slug `republic-of-noobistan`. It then loads each player profile to display the member avatar and title when available. No API key is required.


## v1.5 changes

- Corrected the Chess.com member parser so it supports both username strings and member objects.
- Removed the Open Club / Republic Headquarters links because the dashboard is embedded on the club page.


## v1.5 member-board correction

The board now reads `all_time`, sorts members by the Chess.com club `joined` timestamp in descending order, and displays the six newest club members.
