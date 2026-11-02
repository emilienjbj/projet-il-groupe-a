# Mise en place du dépôt (à faire une seule fois, par une seule personne)

1. Sur github.com, créer un dépôt **vide** nommé `projet-il-groupe-a` (privé, sans README).
2. Dans un terminal, depuis ce dossier :

```bash
git config user.name "Votre Nom"
git config user.email "email-de-votre-compte-github"
git init -b main
git add .
git commit -m "Initialisation du dépôt : structure, README, documents du premier rendu"
git remote add origin https://github.com/VOTRE-COMPTE/projet-il-groupe-a.git
git push -u origin main
```

3. Sur GitHub : Settings, Collaborators, Add people (inviter les trois autres).
4. Sur GitHub : Settings, Branches, Add branch protection rule sur `main`, cocher
   « Require a pull request before merging » avec 1 approbation (si le plan du compte le permet).
5. Chacun clone ensuite le dépôt, configure son nom et son e-mail Git, puis lance
   `npm install` et `npm test`.
