/* ============================================================
   Kernveil — email guard
   Validates the shape of an address and rejects throwaway providers.

   This is a cheap local filter, not a deliverability check. It stops the
   obvious junk (mailinator, guerrillamail, a throwaway gmail alias) before we
   send anything. Real verification is handled separately by the
   one-time code flow in /api/verify.
   ============================================================ */

/** Providers that exist to be disposable. Kept as a plain set: no network. */
const DISPOSABLE = new Set([
  "0-mail.com", "10mail.org", "10minutemail.co.uk", "10minutemail.com",
  "1secmail.com", "1secmail.net", "1secmail.org", "20minutemail.com",
  "33mail.com", "3d-painting.com", "4warding.com", "60minutemail.com",
  "anonbox.net", "anonymbox.com", "armyspy.com", "binkmail.com",
  "bobmail.info", "bugmenot.com", "bumpymail.com", "burnermail.io",
  "byom.de", "cock.li", "cool.fr.nf", "correotemporal.org",
  "crazymailing.com", "cuvox.de", "dayrep.com", "deadaddress.com",
  "deadly.men", "discardmail.com", "discardmail.de", "disposableaddress.com",
  "disposeamail.com", "dispose.it", "dispostable.com", "dodgeit.com",
  "dodgit.com", "dontreg.com", "dontsendmespam.de", "dropmail.me",
  "e4ward.com", "einrot.com", "emailgo.de", "emailias.com",
  "emailondeck.com", "emailsensei.com", "emailtemporanea.com",
  "emailtemporanea.net", "emailtemporar.ro", "emailtemporario.com.br",
  "emailthe.net", "emailtmp.com", "emailwarden.com", "fakeinbox.com",
  "fakemail.net", "fakemailgenerator.com", "fansworldwide.de", "fastacura.com",
  "filzmail.com", "fleckens.hu", "forgetmail.com", "garliclife.com",
  "get2mail.fr", "getairmail.com", "getnada.com", "ghosttexter.de",
  "girlsundertheinfluence.com", "gishpuppy.com", "googlesist.com",
  "gorillaswithdirtyarmpits.com", "gotmail.net", "gotmail.org",
  "gowikibooks.com", "great-host.in", "greensloth.com", "gsrv.co.uk",
  "guerrillamail.biz", "guerrillamail.com", "guerrillamail.de",
  "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "harakirimail.com", "hidemail.de",
  "hochsitze.com", "hotpop.com", "hulapla.de", "ieatspam.eu",
  "ieatspam.info", "ihateyoualot.info", "iheartspam.org", "imails.info",
  "inbax.tk", "inbox.si", "inboxalias.com", "inboxbear.com",
  "inboxclean.com", "inboxclean.org", "incognitomail.com", "incognitomail.net",
  "incognitomail.org", "jetable.com", "jetable.net", "jetable.org",
  "jnxjn.com", "jourrapide.com", "jsrsolutions.com", "kasmail.com",
  "kaspop.com", "killmail.com", "killmail.net", "klassmaster.com",
  "klzlk.com", "kurzepost.de", "lawlita.com", "letthemeatspam.com",
  "lhsdv.com", "lifebyfood.com", "lookugly.com", "lopl.co.cc",
  "lr78.com", "lroid.com", "maboard.com", "mail-filter.com",
  "mail-temporaire.fr", "mail.by", "mail4trash.com", "mailbidon.com",
  "mailbiz.biz", "mailblocks.com", "mailbucket.org", "mailcat.biz",
  "mailcatch.com", "mailde.de", "mailde.info", "maildrop.cc",
  "maileimer.de", "mailexpire.com", "mailfa.tk", "mailforspam.com",
  "mailfreeonline.com", "mailguard.me", "mailin8r.com", "mailinater.com",
  "mailinator.com", "mailinator.net", "mailinator.org", "mailinator2.com",
  "mailincubator.com", "mailismagic.com", "mailme.lv", "mailmetrash.com",
  "mailmoat.com", "mailnesia.com", "mailnull.com", "mailorg.org",
  "mailpick.biz", "mailrock.biz", "mailscrap.com", "mailshell.com",
  "mailsiphon.com", "mailslurp.com", "mailsmax.com", "mailtemp.info",
  "mailtome.de", "mailtothis.com", "mailtrash.net", "mailtv.net",
  "mailzilla.com", "mbx.cc", "mega.zik.dj", "meinspamschutz.de",
  "meltmail.com", "messagebeamer.de", "mierdamail.com", "mintemail.com",
  "moburl.com", "moncourrier.fr.nf", "monemail.net", "monmail.ws",
  "msa.minsmail.com", "mt2009.com", "mt2014.com", "mycard.net.ua",
  "mycleaninbox.net", "mymail-in.net", "mypacks.net", "mypartyclip.de",
  "myphantomemail.com", "mysamp.de", "mytempemail.com", "mytempmail.com",
  "mytrashmail.com", "nabuma.com", "neomailbox.com", "nepwk.com",
  "nervmich.net", "nervtmich.net", "netmails.com", "netmails.net",
  "neverbox.com", "nice-4u.com", "nincsmail.hu", "nnh.com",
  "no-spam.ws", "noblepioneer.com", "nomail.xl.cx", "nomail2me.com",
  "nospam.ze.tc", "nospam4.us", "nospamfor.us", "nospammail.net",
  "notmailinator.com", "nowhere.org", "nowmymail.com", "nurfuerspam.de",
  "objectmail.com", "obobbo.com", "odnorazovoe.ru", "oneoffemail.com",
  "onewaymail.com", "onlatedotcom.info", "online.ms", "opayq.com",
  "ordinaryamerican.net", "otherinbox.com", "ovpn.to", "owlpic.com",
  "pancakemail.com", "pcusers.otherinbox.com", "pjjkp.com",
  "politikerclub.de", "poofy.org", "pookmail.com", "privacy.net",
  "privatdemail.net", "proxymail.eu", "prtnx.com", "putthisinyourspamdatabase.com",
  "quickinbox.com", "rcpt.at", "reallymymail.com", "recode.me",
  "recursor.net", "reliable-mail.com", "rhyta.com", "rmqkr.net",
  "royal.net", "rtrtr.com", "s0ny.net", "safe-mail.net", "safersignup.de",
  "safetymail.info", "sandelf.de", "saynotospams.com", "selfdestructingmail.com",
  "sendspamhere.com", "sharklasers.com", "shieldedmail.com", "shiftmail.com",
  "shitmail.me", "shortmail.net", "sibmail.com", "skeefmail.com",
  "slapsfromlastnight.com", "slaskpost.se", "smashmail.de", "smellfear.com",
  "snakemail.com", "sneakemail.com", "sofimail.com", "sofort-mail.de",
  "sogetthis.com", "soodonims.com", "spam4.me", "spamavert.com",
  "spambob.com", "spambob.net", "spambob.org", "spambox.us",
  "spambox.info", "spambox.net", "spambox.org", "spamcannon.com",
  "spamcannon.net", "spamcannon.org", "spamcon.org", "spamcorptastic.com",
  "spamcowboy.com", "spamcowboy.net", "spamcowboy.org", "spamday.com",
  "spamex.com", "spamfree.eu", "spamfree24.com", "spamfree24.de",
  "spamfree24.org", "spamgoes.in", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org", "spamherelots.com", "spamhereplease.com",
  "spamhole.com", "spamify.com", "spaminator.de", "spamkill.info",
  "spaml.com", "spammotel.com", "spamobox.com", "spamslicer.com",
  "spamspot.com", "spamthis.co.uk", "spamtroll.net", "speed.1s.fr",
  "spoofmail.de", "stuffmail.de", "super-auswahl.de", "superrito.com",
  "supergreatmail.com", "supermailer.jp", "superrito.com", "suremail.info",
  "teewars.org", "teleworm.us", "temp-mail.org", "temp-mail.ru",
  "tempe-mail.com", "tempemail.biz", "tempemail.com", "tempemail.net",
  "tempinbox.co.uk", "tempinbox.com", "tempmail.eu", "tempmail.it",
  "tempmail2.com", "tempmaildemo.com", "tempmailer.com", "tempmailer.de",
  "tempmail.com", "tempmail.net", "tempmail.org", "tempmail.us",
  "tempmail.se", "tempmail.io", "tempmail.co", "tempmailaddress.com",
  "temp-mail.com", "temp-mail.io", "tempmailbox.com", "tempmails.net",
  "emailondeck.com", "emailfake.com", "email-fake.com", "fakeinbox.com",
  "fakemail.net", "fakemailgenerator.com", "fakemail.io", "emailisvalid.com",
  "mytemp.email", "discard.email", "emailgo.de", "emailias.com",
  "tempomail.fr", "temporaryemail.net", "temporaryforwarding.com",
  "temporaryinbox.com", "temporarymailaddress.com", "tempthe.net",
  "thankyou2010.com", "thc.st", "thelimestones.com", "thisisnotmyrealemail.com",
  "throwawayemailaddress.com", "tilien.com", "tittbit.in", "tizi.com",
  "tmailinator.com", "toomail.biz", "topranklist.de", "tradermail.info",
  "trash-amil.com", "trash-mail.at", "trash-mail.com", "trash-mail.de",
  "trash2009.com", "trashdevil.com", "trashemail.de", "trashmail.at",
  "trashmail.com", "trashmail.de", "trashmail.me", "trashmail.net",
  "trashmail.org", "trashmail.ws", "trbvm.com", "turual.com",
  "twinmail.de", "tyldd.com", "uggsrock.com", "umail.net", "uroid.com",
  "us.af", "venompen.com", "veryrealemail.com", "vomoto.com",
  "vpn.st", "vsimcard.com", "vubby.com", "wasteland.rfc822.org",
  "webemail.me", "weg-werf-email.de", "wegwerf-emails.de", "wegwerfadresse.de",
  "wegwerfemail.com", "wegwerfemail.de", "wegwerfmail.de", "wegwerfmail.info",
  "wegwerfmail.net", "wegwerfmail.org", "wh4f.org", "whyspam.me",
  "willselfdestruct.com", "winemaven.info", "wronghead.com", "wuzup.net",
  "wwjmp.com", "xagloo.com", "xemaps.com", "xents.com", "xmaily.com",
  "xoxy.net", "yapped.net", "yeah.net", "yep.it", "yogamaven.com",
  "yopmail.com", "yopmail.fr", "yopmail.net", "yourdomain.com",
  "ypmail.webarnak.fr.eu.org", "z1p.biz", "zehnminuten.de", "zehnminutenmail.de",
  "zippymail.info", "zoemail.net", "zomg.info",
]);

/** Common typos that would silently drop leads into a dead mailbox. */
const TYPO_HINTS = {
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlok.com": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "icloud.co": "icloud.com",
};

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i;

/**
 * @returns {{ok: true, email: string, domain: string}
 *          |{ok: false, error: string}}
 */
export function validateEmail(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return { ok: false, error: "Enter your email address." };
  if (raw.length > 254) return { ok: false, error: "That email address is too long." };
  if (!EMAIL_RE.test(raw)) return { ok: false, error: "That does not look like an email address." };

  const domain = raw.split("@")[1];

  // Reject a leading dot or consecutive dots, which some clients reject.
  if (raw.includes("..") || raw.startsWith(".")) {
    return { ok: false, error: "That email address is not valid." };
  }

  if (DISPOSABLE.has(domain)) {
    return {
      ok: false,
      error: "Disposable inboxes cannot receive a report. Use your work or personal address.",
    };
  }

  // Sub-domains of a disposable provider are disposable too.
  const parent = domain.split(".").slice(-2).join(".");
  if (DISPOSABLE.has(parent)) {
    return {
      ok: false,
      error: "Disposable inboxes cannot receive a report. Use your work or personal address.",
    };
  }

  return { ok: true, email: raw, domain };
}

/** Non-blocking nudge for a likely typo. */
export function typoSuggestion(domain) {
  return TYPO_HINTS[domain] || null;
}