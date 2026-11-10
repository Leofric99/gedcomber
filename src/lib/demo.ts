import { parseGedcom, updatePerson } from './gedcom'
export function demoDataset() {
  const people = [
    ['I1', 'Eleanor Margaret', 'Ashford', 'F', '14 MAY 1942', 'Bath, Somerset', '', '', 'Teacher'],
    [
      'I2',
      'Thomas James',
      'Ashford',
      'M',
      '3 MAR 1914',
      'Bath, Somerset',
      '9 OCT 1987',
      'Bristol',
      'Architect',
    ],
    [
      'I3',
      'Rose Elizabeth',
      'Whitmore',
      'F',
      '21 JUN 1918',
      'Wells, Somerset',
      '12 JAN 2002',
      'Bath',
      'Botanical illustrator',
    ],
    [
      'I4',
      'William Henry',
      'Ashford',
      'M',
      '8 SEP 1883',
      'Frome, Somerset',
      '4 FEB 1961',
      'Bath',
      'Cabinetmaker',
    ],
    [
      'I5',
      'Florence May',
      'Bennett',
      'F',
      '12 APR 1888',
      'Bath, Somerset',
      '17 AUG 1975',
      'Bath',
      'Seamstress',
    ],
    [
      'I6',
      'Arthur Edward',
      'Whitmore',
      'M',
      '2 FEB 1889',
      'Wells, Somerset',
      '11 NOV 1964',
      'Wells',
      'Gardener',
    ],
    [
      'I7',
      'Beatrice Anne',
      'Clarke',
      'F',
      '18 NOV 1892',
      'Glastonbury',
      '6 JUL 1978',
      'Wells',
      'Librarian',
    ],
    ['I8', 'Henry Thomas', 'Ashford', 'M', '9 DEC 1939', 'Bath, Somerset', '', '', 'Engineer'],
    ['I9', 'Clara Rose', 'Ashford', 'F', '23 AUG 1945', 'Bath, Somerset', '', '', 'Nurse'],
    ['I10', 'Edward Charles', 'Hale', 'M', '16 JAN 1940', 'Oxford, Oxfordshire', '', '', 'Writer'],
    [
      'I11',
      'Oliver James',
      'Hale',
      'M',
      '5 APR 1966',
      'Oxford, Oxfordshire',
      '',
      '',
      'Photographer',
    ],
    ['I12', 'Alice Eleanor', 'Hale', 'F', '11 JUN 1969', 'Oxford, Oxfordshire', '', '', 'Designer'],
    [
      'I13',
      'Margaret Louise',
      'Ashford',
      'F',
      '7 JUL 1916',
      'Bath, Somerset',
      '21 MAR 2008',
      'Bristol',
      'Musician',
    ],
    ['I14', 'Daniel', 'Hale', 'M', '12 OCT 1995', 'London', '', '', ''],
    ['I15', 'Sophie', 'Hale', 'F', '19 FEB 1998', 'London', '', '', ''],
  ]
  let text =
    '0 HEAD\n1 SOUR GEDCOMBER_DEMO\n1 GEDC\n2 VERS 5.5.1\n2 FORM LINEAGE-LINKED\n1 CHAR UTF-8\n'
  for (const [id, given, surname, sex, birth, place, death, deathplace, occupation] of people) {
    text += `0 @${id}@ INDI\n1 NAME ${given} /${surname}/\n1 SEX ${sex}\n1 BIRT\n2 DATE ${birth}\n2 PLAC ${place}\n`
    if (death) text += `1 DEAT\n2 DATE ${death}\n2 PLAC ${deathplace}\n`
    if (occupation) text += `1 OCCU ${occupation}\n`
  }
  text +=
    '0 @F1@ FAM\n1 HUSB @I2@\n1 WIFE @I3@\n1 CHIL @I8@\n1 CHIL @I1@\n1 CHIL @I9@\n0 @F2@ FAM\n1 HUSB @I4@\n1 WIFE @I5@\n1 CHIL @I2@\n1 CHIL @I13@\n0 @F3@ FAM\n1 HUSB @I6@\n1 WIFE @I7@\n1 CHIL @I3@\n0 @F4@ FAM\n1 HUSB @I10@\n1 WIFE @I1@\n1 CHIL @I11@\n1 CHIL @I12@\n0 @F5@ FAM\n1 HUSB @I11@\n1 CHIL @I14@\n1 CHIL @I15@\n0 TRLR\n'
  const dataset = parseGedcom(text, 'The Ashford family.ged')
  const story =
    'Eleanor was born on a bright May morning in Bath, the second of three children. Her childhood was filled with the smell of her mother’s watercolours and the sound of her father sketching plans at the kitchen table.\n\nShe spent her summers exploring the gardens of Somerset with her grandfather Arthur, who taught her the names of every wildflower along the lanes. It was there that her lifelong love of the natural world began.\n\nAfter training as a teacher, Eleanor moved to Oxford. She met Edward in a bookshop on a rainy Saturday afternoon in 1963. They married two years later and made a home filled with books, music, and the laughter of their children, Oliver and Alice.\n\nFor more than thirty years, she taught generations of children to read. Her classroom always had fresh flowers on the windowsill, and she never forgot a birthday.\n\nIn retirement, Eleanor began gathering the family’s photographs and stories. “We are all part of something larger,” she would say, carefully writing names on the back of each photograph. This collection is part of her legacy.'
  return updatePerson(dataset, { ...dataset.people['@I1@'], story })
}
