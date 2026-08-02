/**
 * PE32 DLL loaded into Lunar Magic's process so GetMenu/GetMenuState see a
 * valid in-process HMENU (Wine/Windows menu handles are not usable cross-process).
 *
 * Export: DWORD WINAPI LmautoWriteMenuState(LPCSTR outPath)
 *   Writes JSON object of View WM_COMMAND id -> checked bool.
 */
#include <windows.h>
#include <stdio.h>

#ifndef MF_BYCOMMAND
#define MF_BYCOMMAND 0x0000
#endif
#ifndef MF_CHECKED
#define MF_CHECKED 0x0008
#endif

static const UINT kViewIds[] = {
    9200, /* Layer 1 */
    9201, /* Layer 2 */
    9203, /* Sprites */
    9204, /* Sprite Data Hex */
    9205, /* Screen Exits */
    9206, /* Sub-Screen Boundaries */
    9207, /* Game View */
    9220, /* Animation */
    9224, /* Tile Grid */
    9231, /* Layer 3 */
    9232, /* Tile Surface Outlines */
    9233, /* Line Guide Outlines */
    9234, /* Exit Enabled Tiles */
    9235, /* Block Contents */
    9236, /* Level Entrances */
    9290, /* Zoom 100% (may be radio; still report checked) */
};

static int write_checked(FILE *f, HMENU menu, UINT id, int *first) {
  UINT st = GetMenuState(menu, id, MF_BYCOMMAND);
  if (st == (UINT)-1) return 0;
  if (!*first) fputc(',', f);
  *first = 0;
  fprintf(f, "\n  \"%u\": %s", (unsigned)id, (st & MF_CHECKED) ? "true" : "false");
  return 1;
}

static void walk_menu(HMENU menu, FILE *f, int *first) {
  int i, n, nid;
  if (!menu || !IsMenu(menu)) return;

  nid = (int)(sizeof kViewIds / sizeof kViewIds[0]);
  for (i = 0; i < nid; i++) write_checked(f, menu, kViewIds[i], first);

  n = GetMenuItemCount(menu);
  if (n < 0) return;
  for (i = 0; i < n; i++) {
    HMENU sub = GetSubMenu(menu, i);
    if (sub) walk_menu(sub, f, first);
  }
}

__declspec(dllexport) DWORD WINAPI LmautoWriteMenuState(LPCSTR outPath) {
  HWND hwnd;
  HMENU root;
  FILE *f;
  int first = 1;

  if (!outPath || !outPath[0]) return 10;

  hwnd = FindWindowA("LMFrame", NULL);
  if (!hwnd) return 1;

  root = GetMenu(hwnd);
  if (!root || !IsMenu(root)) return 2;

  f = fopen(outPath, "wb");
  if (!f) return 3;

  fputc('{', f);
  walk_menu(root, f, &first);
  fprintf(f, "\n}\n");
  fclose(f);

  return first ? 4 : 0; /* 4 = no view ids found */
}

BOOL WINAPI DllMain(HINSTANCE hinst, DWORD reason, LPVOID reserved) {
  (void)hinst;
  (void)reason;
  (void)reserved;
  return TRUE;
}
